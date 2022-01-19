// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// contracts
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {IncreOwnable} from "./utils/IncreOwnable.sol";
import {VirtualToken} from "./tokens/VirtualToken.sol";

// interfaces
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";
import {IOracle} from "./interfaces/IOracle.sol";
import {IVirtualToken} from "./interfaces/IVirtualToken.sol";

// libraries
import {LibFunding} from "./lib/LibFunding.sol";
import {LibMath} from "./lib/LibMath.sol";
import {LibPerpetual} from "./lib/LibPerpetual.sol";
import {LibReserve} from "./lib/LibReserve.sol";

import "hardhat/console.sol";

contract Perpetual is IPerpetual, Context, IncreOwnable, Pausable {
    using SafeCast for uint256;
    using SafeCast for int256;

    // parameterization
    int256 public constant MIN_MARGIN = 25e15; // 2.5%
    uint256 public constant LIQUIDATION_FEE = 60e15; // 6%
    uint256 public constant TWAP_FREQUENCY = 15 minutes; // time after which funding rate CAN be calculated
    int256 public constant FEE = 3e16; // 3%
    int256 public constant MIN_MARGIN_AT_CREATION = MIN_MARGIN + FEE;
    uint256 public constant VQUOTE_INDEX = 0;
    uint256 public constant VBASE_INDEX = 1;

    // dependencies
    ICryptoSwap public override market;
    IOracle public override oracle;
    IVirtualToken public override vBase;
    IVirtualToken public override vQuote;
    IVault public override vault;

    // global state
    LibPerpetual.GlobalPosition internal globalPosition;
    LibPerpetual.Price[] internal prices;
    uint256 public totalLiquidityProvided;

    // liquidity provider state
    mapping(address => LibPerpetual.LiquidityPosition) public liquidityPosition;

    // user state
    mapping(address => LibPerpetual.TraderPosition) internal userPosition;

    constructor(
        IOracle _oracle,
        IVirtualToken _vBase,
        IVirtualToken _vQuote,
        ICryptoSwap _curvePool,
        IVault _vault
    ) {
        oracle = _oracle;
        vBase = _vBase;
        vQuote = _vQuote;
        market = _curvePool;
        vault = _vault;

        // approve all future transfers between Perpetual and market (curve pool)
        vBase.approve(address(market), type(uint256).max);
        vQuote.approve(address(market), type(uint256).max);
    }

    // global getter
    function getLatestPrice() public view override returns (LibPerpetual.Price memory) {
        return getPrice(prices.length - 1);
    }

    function getPrice(uint256 period) public view override returns (LibPerpetual.Price memory) {
        return prices[period];
    }

    function getGlobalPosition() public view override returns (LibPerpetual.GlobalPosition memory) {
        return globalPosition;
    }

    // user getter
    function getUserPosition(address account) public view override returns (LibPerpetual.TraderPosition memory) {
        return userPosition[account];
    }

    // functions
    function setPrice(LibPerpetual.Price memory newPrice) external override {
        prices.push(newPrice);
    }

    /// @notice Deposits tokens into the vault
    function deposit(uint256 amount, IERC20 token) external override {
        vault.deposit(_msgSender(), amount, token);
        emit Deposit(_msgSender(), address(token), amount);
    }

    /// @notice Withdraw tokens from the vault
    function withdraw(uint256 amount, IERC20 token) external override {
        require(getUserPosition(_msgSender()).notional == 0, "Has open position");

        vault.withdraw(_msgSender(), amount, token);
        emit Withdraw(_msgSender(), address(token), amount);
    }

    /// @notice Open position, long or short
    /// @notice Prices are quoted in vQuote: https://www.delta.exchange/blog/support/what-is-an-inverse-futures-contract
    /// @param amount Amount of virtual tokens to be bought
    /// @param direction Side of the position to open, long or short
    /// @dev No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGIN
    /// @dev No checks are done if bought amount exceeds allowance
    function openPosition(uint256 amount, LibPerpetual.Side direction) external override returns (uint256) {
        address sender = _msgSender();
        LibPerpetual.TraderPosition storage user = userPosition[sender];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        // transform USDC amount with 6 decimals to a value with 18 decimals
        uint256 convertedWadAmount = LibReserve.tokenToWad(vault.getReserveTokenDecimals(), amount);

        // Checks
        require(convertedWadAmount > 0, "The amount can't be null");
        require(user.notional == 0, "Cannot open a position with one already opened");

        int256 prospectiveMargin = LibMath.wadDiv(vault.getReserveValue(sender), convertedWadAmount.toInt256());
        require(
            prospectiveMargin >= MIN_MARGIN_AT_CREATION,
            "Not enough funds in the vault for the margin of this position"
        );

        updateFundingRate();

        // Buy virtual tokens for the position
        uint256 vTokenBought = _openPositionOnMarket(convertedWadAmount, direction);

        // Update trader position
        user.notional = convertedWadAmount;
        user.positionSize = vTokenBought;
        user.profit = 0;
        user.side = direction;
        user.timeStamp = global.timeStamp; // note: timestamp of the last update of the cumFundingRate
        user.cumFundingRate = global.cumFundingRate;

        emit OpenPosition(sender, uint128(block.timestamp), direction, convertedWadAmount, vTokenBought);
        return vTokenBought;
    }

    /// @notice Create virtual tokens and sell them in the pool
    function _openPositionOnMarket(uint256 amount, LibPerpetual.Side direction) internal returns (uint256) {
        uint256 vTokenBought = 0;

        // long: swap vQuote for vBase
        // short: swap vBase for vQuote
        if (direction == LibPerpetual.Side.Long) {
            vQuote.mint(amount);
            vTokenBought = market.exchange(VQUOTE_INDEX, VBASE_INDEX, amount, 0);
        } else if (direction == LibPerpetual.Side.Short) {
            uint256 baseOnQuotePrice = indexPrice().toUint256();
            uint256 vBaseAmount = LibMath.wadDiv(amount, baseOnQuotePrice);

            vBase.mint(vBaseAmount);
            vTokenBought = market.exchange(VBASE_INDEX, VQUOTE_INDEX, vBaseAmount, 0);
        }
        return vTokenBought;
    }

    /// @notice Closes position from account holder
    function closePosition() external override {
        LibPerpetual.TraderPosition storage user = userPosition[_msgSender()];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        require(user.notional != 0, "No position currently opened");

        updateFundingRate();

        _closePosition(user, global);

        // console.log("user.profit");
        // console.logInt(user.profit);
        // apply changes to collateral
        vault.settleProfit(_msgSender(), user.profit);
        delete userPosition[_msgSender()];
    }

    /// @dev Used both by traders closing their own positions and liquidators liquidaty other people's positions
    /// @notice user.profit is the sum of funding payments and the position PnL
    function _closePosition(LibPerpetual.TraderPosition storage user, LibPerpetual.GlobalPosition storage global)
        internal
    {
        uint256 amount = user.positionSize;
        LibPerpetual.Side direction = user.side;

        uint256 vQuoteProceeds = _closePositionOnMarket(amount, direction);

        // update user.profit using funding payment info in the `global` struct
        settleFundingRate(user, global);

        // console.log("hardhat: user.notional", user.notional.toUint256());
        // console.log("hardhat: vQuoteProceeds", vQuoteProceeds);
        // set trader position
        user.profit += _calculatePnL(user.notional, vQuoteProceeds);
        user.notional = 0;
        user.positionSize = 0;
    }

    /// @notice Sell back virtual tokens and burn the ones received
    function _closePositionOnMarket(uint256 amount, LibPerpetual.Side direction) internal returns (uint256) {
        uint256 vQuoteProceeds = 0;

        if (direction == LibPerpetual.Side.Long) {
            uint256 vQuoteReceived = market.exchange(VBASE_INDEX, VQUOTE_INDEX, amount, 0);
            vQuote.burn(vQuoteReceived);

            vQuoteProceeds = vQuoteReceived;
        } else {
            uint256 vBaseReceived = market.exchange(VQUOTE_INDEX, VBASE_INDEX, amount, 0);
            vBase.burn(vBaseReceived);

            uint256 baseOnQuotePrice = indexPrice().toUint256();
            vQuoteProceeds = LibMath.wadMul(vBaseReceived, baseOnQuotePrice);
        }

        return vQuoteProceeds;
    }

    /// @notice Calculate the funding rate for the next block
    function updateFundingRate() public {
        // TODO: improve funding rate calculations

        ////////////////////////////////// @TOOO wrap this into some library
        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 currentTime = block.timestamp;
        uint256 timeOfLastTrade = uint256(global.timeOfLastTrade);

        //  if first trade of block
        if (currentTime > timeOfLastTrade) {
            LibFunding.calculateFunding(
                global,
                marketPrice().toInt256(),
                oracle.getIndexPrice(),
                currentTime,
                TWAP_FREQUENCY
            );
        }

        ////////////////////////////////// @TOOO wrap this into some library
    }

    // get information about position
    function _calculatePnL(uint256 boughtPrice, uint256 soldPrice) internal pure returns (int256) {
        return soldPrice.toInt256() - boughtPrice.toInt256();
    }

    /// @notice Applies the funding payments on user.profit
    function settleFundingRate(LibPerpetual.TraderPosition storage user, LibPerpetual.GlobalPosition storage global)
        internal
    {
        if (user.notional != 0 && user.timeStamp < global.timeStamp) {
            // update user variables when position opened before last update
            int256 upcomingFundingPayment = getFundingPayments(user, global);
            user.profit += upcomingFundingPayment;
            emit Settlement(_msgSender(), user.timeStamp, upcomingFundingPayment);
        }

        // update user variables to global state
        user.timeStamp = global.timeStamp;
        user.cumFundingRate = global.cumFundingRate;
    }

    /// @notice Calculate missed funding payments
    function getFundingPayments(LibPerpetual.TraderPosition memory user, LibPerpetual.GlobalPosition memory global)
        public
        pure
        returns (int256)
    {
        /* Funding rates (as defined in our protocol) are paid from shorts to longs

            case 1: user is long => has missed receiving funding payments (positive or negative)
            case 2: user is short => has missed making funding payments (positive or negative)

            comment: Making an negative funding payment is equvalent to receiving a positive one.
        */
        int256 upcomingFundingRate = 0;
        int256 upcomingFundingPayment = 0;
        if (user.cumFundingRate != global.cumFundingRate) {
            if (user.side == LibPerpetual.Side.Long) {
                upcomingFundingRate = global.cumFundingRate - user.cumFundingRate;
            } else {
                upcomingFundingRate = user.cumFundingRate - global.cumFundingRate;
            }
            upcomingFundingPayment = LibMath.wadDiv(upcomingFundingRate, user.notional.toInt256());
        }
        return upcomingFundingPayment;
    }

    // @notice Return the current market price
    function marketPrice() public view returns (uint256) {
        return market.price_oracle(); // vBase / vQuote
    }

    // @notice Returns the simplified (x/y) market price (TODO: remove this)
    function realizedMarketPrice() public view returns (uint256) {
        return LibMath.wadDiv(market.balances(0), market.balances(1));
    }

    function indexPrice() public view returns (int256) {
        return oracle.getIndexPrice();
    }

    /// @notice Provide liquidity to the pool
    /// @param amount of token to be added to the pool (with token decimals)
    /// @param  token to be added to the pool
    function provideLiquidity(uint256 amount, IERC20 token) external override returns (uint256, uint256) {
        address sender = _msgSender();
        require(amount != 0, "Zero amount");
        require(liquidityPosition[sender].liquidityBalance == 0, "Has provided liquidity before");

        // return amount with 18 decimals
        uint256 wadAmount = vault.deposit(_msgSender(), amount, token);

        uint256 price;
        if (totalLiquidityProvided == 0) {
            price = indexPrice().toUint256();
            //console.log("hardhat: has provided no liquidity");
        } else {
            price = LibMath.wadDiv(market.balances(0), market.balances(1));
            //console.log("hardhat: has provided  liquidity");
        }
        // split liquidity between long and short (TODO: account for value of liquidity provider already made)
        uint256 vQuoteAmount = wadAmount / 2;
        uint256 vBaseAmount = LibMath.wadDiv(vQuoteAmount, price); // vUSD / vEUR/vUSD  <=> 1 / 1.2 = 0.83

        //console.log("hardhat: price", price);
        // mint tokens
        vQuote.mint(vQuoteAmount);
        vBase.mint(vBaseAmount);

        //console.log("hardhat: has vQuote:", vQuoteAmount);
        //console.log("hardhat: has vBase:", vBaseAmount);
        // supply liquidity to curve pool
        //uint256 min_mint_amount = 0; // set to zero for now
        uint256 liquidity = market.add_liquidity([vQuoteAmount, vBaseAmount], 0); //  first token in curve pool is vQuote & second token is vBase

        // increment balances
        liquidityPosition[sender].liquidityBalance += liquidity; // lp tokens
        liquidityPosition[sender].reserveBalance += wadAmount; // usdc tokens
        totalLiquidityProvided += liquidity;

        emit LiquidityProvided(sender, address(token), amount);
        return (vBaseAmount, vQuoteAmount);
    }

    /// @notice Withdraw liquidity from the pool
    /// @param amount of liquidity to be removed from the pool (with 18 decimals)
    /// @param  token to be removed from the pool
    function withdrawLiquidity(uint256 amount, IERC20 token) external override {
        // TODO: should we just hardcode the value here?
        address sender = _msgSender();
        //console.log("hardhat: amount", amount);
        //console.log("hardhat: liquidityPosition[sender].liquidityBalance", liquidityPosition[sender].liquidityBalance);

        require(liquidityPosition[sender].liquidityBalance == amount, "Not enough liquidity provided");

        //console.log("hardhat: trying to withdraw liquidity", amount);
        // remove liquidity from curve pool
        // calc_token_amount
        uint256 vBaseAmount;
        uint256 vQuoteAmount;
        {
            // to avoid stack to deep errors
            uint256 vQuoteBalanceBefore = vQuote.balanceOf(address(this)); // can we just assume 0 here?
            uint256 vBaseBalanceBefore = vBase.balanceOf(address(this));

            //console.log("hardhat vQuoteBalanceBefore", vQuoteBalanceBefore);
            //console.log("hardhat vBaseBalanceBefore", vBaseBalanceBefore);

            market.remove_liquidity(amount, [uint256(0), uint256(0)]);

            uint256 vQuoteBalanceAfter = vQuote.balanceOf(address(this));
            uint256 vBaseBalanceAfter = vBase.balanceOf(address(this));

            //console.log("hardhat vQuoteBalanceAfter", vQuoteBalanceAfter);
            //console.log("hardhat vBaseBalanceAfter", vBaseBalanceAfter);

            vQuoteAmount = vQuoteBalanceAfter - vQuoteBalanceBefore;
            vBaseAmount = vBaseBalanceAfter - vBaseBalanceBefore;

            //console.log("hardhat vQuoteAmount", vQuoteAmount);
            //console.log("hardhat vBaseAmount", vBaseAmount);
        }
        //console.log("hardhat: has withdrawn", vBaseAmount, vQuoteAmount);

        // burn virtual tokens
        vBase.burn(vBaseAmount);
        vQuote.burn(vQuoteAmount);

        // TODO: calculate profit from operation ... profit = returned money - deposited money

        uint256 price = indexPrice().toUint256(); // always use chainlink oracle

        // split liquidity between long and short (TODO: account for value of liquidity provider already made)
        uint256 withdrawableAmount = vQuoteAmount + LibMath.wadMul(vBaseAmount, price);
        //console.log("hardhat: withdrawableAmount is", withdrawableAmount);

        int256 profit = withdrawableAmount.toInt256() - liquidityPosition[sender].reserveBalance.toInt256();

        //console.log("hardhat: profit is", profit > 0 ? profit.toUint256() : (-1 * profit).toUint256());
        vault.settleProfit(sender, profit);

        //console.log("hardhat: withdraw all");

        vault.withdrawAll(sender, token); // TODO: withdraw all liquidity

        //console.log("hardhat: increment balances");

        //console.log("hardhat: liquidityPosition[sender].liquidityBalance", liquidityPosition[sender].liquidityBalance);
        //console.log("hardhat: totalLiquidityProvided", totalLiquidityProvided);
        // lower balances

        totalLiquidityProvided -= amount;

        //console.log("hardhat: finito");

        delete liquidityPosition[sender];

        emit LiquidityWithdrawn(sender, address(token), amount);
    }

    function marginIsValid(address account) public view override returns (bool) {
        int256 marginRatioRes = marginRatio(account);
        // console.log("marginRatioRes");
        // console.logInt(marginRatioRes);
        // console.log("MIN_MARGIN");
        // console.logInt(MIN_MARGIN);

        return marginRatioRes >= MIN_MARGIN;
        // return marginRatio(account) <= MIN_MARGIN;
    }

    function marginRatio(address account) public view override returns (int256) {
        LibPerpetual.TraderPosition memory user = userPosition[account];
        LibPerpetual.GlobalPosition memory global = globalPosition;

        // margin ratio = (collateral + unrealizedPositionPnl + fundingPayments) / user.notional
        // all amounts should be expressed in vQuote/USD, otherwise the end result doesn't make sense
        int256 collateral = vault.getReserveValue(account);
        int256 fundingPayments = getFundingPayments(user, global);

        uint256 vQuoteVirtualProceeds = 0;
        if (user.side == LibPerpetual.Side.Long) {
            vQuoteVirtualProceeds = market.get_dy(VBASE_INDEX, VQUOTE_INDEX, uint256(user.positionSize));
        } else {
            uint256 vBaseReceived = market.get_dy(VQUOTE_INDEX, VBASE_INDEX, uint256(user.positionSize));

            uint256 baseOnQuotePrice = indexPrice().toUint256();
            vQuoteVirtualProceeds = LibMath.wadMul(vBaseReceived, baseOnQuotePrice);
        }

        int256 unrealizedPositionPnl = _calculatePnL(user.notional, vQuoteVirtualProceeds);

        return LibMath.wadDiv(collateral + unrealizedPositionPnl + fundingPayments, user.notional.toInt256());
    }

    function liquidate(address account) external {
        updateFundingRate();

        require(!marginIsValid(account), "Margin is valid");
        address liquidator = _msgSender();

        // load information about state
        LibPerpetual.TraderPosition storage user = userPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 notionalAmount = user.notional;

        _closePosition(user, global);

        uint256 liquidationFeeAmount = LibMath.wadMul(notionalAmount, LIQUIDATION_FEE);

        // substract fee from user account
        int256 reducedProfit = user.profit - liquidationFeeAmount.toInt256();
        vault.settleProfit(account, reducedProfit);

        // add fee to liquidator account
        vault.settleProfit(liquidator, liquidationFeeAmount.toInt256());

        emit LiquidationCall(account, liquidator, uint128(block.timestamp), notionalAmount);
    }
}
