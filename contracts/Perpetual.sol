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
import {PoolTWAPOracle} from "./oracles/PoolTWAPOracle.sol";
import {ChainlinkTWAPOracle} from "./oracles/ChainlinkTWAPOracle.sol";

// interfaces
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";
import {IChainlinkOracle} from "./interfaces/IChainlinkOracle.sol";
import {IVirtualToken} from "./interfaces/IVirtualToken.sol";

// libraries
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
    int256 public constant MIN_MARGIN_AT_CREATION = 50e15; // 5%
    uint256 public constant VQUOTE_INDEX = 0;
    uint256 public constant VBASE_INDEX = 1;
    int256 public constant SENSITIVITY = 1e18; // funding rate sensitivity to price deviations

    // dependencies
    ICryptoSwap public override market;
    PoolTWAPOracle public override poolTWAPOracle;
    ChainlinkTWAPOracle public override chainlinkTWAPOracle;
    IChainlinkOracle public override chainlinkOracle;
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
        IChainlinkOracle _chainlinkOracle,
        PoolTWAPOracle _poolTWAPOracle,
        ChainlinkTWAPOracle _chainlinkTWAPOracle,
        IVirtualToken _vBase,
        IVirtualToken _vQuote,
        ICryptoSwap _curvePool,
        IVault _vault
    ) {
        chainlinkOracle = _chainlinkOracle;
        poolTWAPOracle = _poolTWAPOracle;
        chainlinkTWAPOracle = _chainlinkTWAPOracle;
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
        require(getUserPosition(_msgSender()).openNotional == 0, "Has open position");

        vault.withdraw(_msgSender(), amount, token);
        emit Withdraw(_msgSender(), address(token), amount);
    }

    /// @notice Open position, long or short
    /// @notice Prices are quoted in vQuote: https://www.delta.exchange/blog/support/what-is-an-inverse-futures-contract
    /// @param amount Amount of virtual tokens to be sold
    /// @dev No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGIN
    /// @dev No checks are done if bought amount exceeds allowance
    function openPosition(uint256 amount, LibPerpetual.Side direction) external override returns (int256, int256) {
        /*
            if amount > 0

                trader goes long EUR
                trader accrues openNotional debt
                trader accrues positionSize assets

                openNotional = vUSD traded   to market   ( < 0)
                positionSize = vEUR received from market ( > 0)

            else amount < 0

                trader goes short EUR
                trader accrues openNotional assets
                trader accrues positionSize debt

                openNotional = vUSD received from market ( > 0)
                positionSize = vEUR traded   to market   ( < 0)

        */

        address sender = _msgSender();

        require(amount > 0, "Not zero amount");
        require(userPosition[sender].openNotional == 0, "Cannot open a position with one already opened");

        chainlinkTWAPOracle.updateEURUSDTWAP();
        poolTWAPOracle.updateEURUSDTWAP();
        updateFundingRate();

        // open position
        bool isLong = direction == LibPerpetual.Side.Long ? true : false;
        (int256 openNotional, int256 positionSize) = _openPosition(amount, isLong);

        // update position
        userPosition[sender] = LibPerpetual.TraderPosition({
            openNotional: openNotional,
            positionSize: positionSize,
            cumFundingRate: globalPosition.cumFundingRate,
            profit: 0
        });

        require(marginIsValid(sender, MIN_MARGIN_AT_CREATION), "Not enough margin");

        emit OpenPosition(sender, uint128(block.timestamp), direction, openNotional, positionSize);

        return (openNotional, positionSize);
    }

    function _openPosition(uint256 amount, bool isLong) internal returns (int256 openNotional, int256 positionSize) {
        /*  if long:
                openNotional = vUSD traded   to market   ( < 0)
                positionSize = vEUR received from market ( > 0)
            if short:
                openNotional = vEUR traded   to market   ( < 0)
                positionSize = vUSD received from market ( > 0)
        */

        if (isLong) {
            positionSize = -(market.exchange(VBASE_INDEX, VQUOTE_INDEX, amount, 0)).toInt256();
            openNotional = amount.toInt256();
        } else {
            positionSize = (market.exchange(VQUOTE_INDEX, VBASE_INDEX, amount, 0)).toInt256();
            openNotional = -amount.toInt256();
        }
    }

    /// @notice Closes position from account holder
    function closePosition() external override {
        LibPerpetual.TraderPosition storage user = userPosition[_msgSender()];
        LibPerpetual.GlobalPosition storage global = globalPosition;
        require(user.openNotional != 0, "No position currently opened");

        chainlinkTWAPOracle.updateEURUSDTWAP();
        poolTWAPOracle.updateEURUSDTWAP();
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
    /// @dev Used both by traders closing their own positions and liquidators liquidaty other people's positions
    /// @notice user.profit is the sum of funding payments and the position PnL
    function _closePosition(LibPerpetual.TraderPosition storage user, LibPerpetual.GlobalPosition storage global)
        internal
    {
        // update user.profit using funding payment info in the `global` struct
        user.profit += _settleFundingRate(user, global);
        user.profit += user.openNotional - _closePositionOnMarket(user.positionSize);

        user.openNotional = 0;
        user.positionSize = 0;
    }

    function _closePositionOnMarket(int256 positionSize) internal returns (int256 vQuoteProceeds) {
        bool isLong = positionSize > 0 ? true : false;
        uint256 position = isLong ? positionSize.toUint256() : (-positionSize).toUint256();

        if (isLong) {
            uint256 amount = market.exchange(VBASE_INDEX, VQUOTE_INDEX, position, 0);
            vQuoteProceeds = amount.toInt256();
        } else {
            // sell for exact tokens
            uint256 amount = market.get_dy(VBASE_INDEX, VQUOTE_INDEX, position);
            uint256 vBaseProceeds = market.exchange(VBASE_INDEX, VQUOTE_INDEX, amount, 0);

            console.log("vBaseProceeds:", vBaseProceeds);
            console.log("position:", position);

            require(vBaseProceeds == position, "Not enough returned");
            vQuoteProceeds = -amount.toInt256();
        }
    }

    /// @notice Calculate the funding rate for the current block
    function updateFundingRate() public {
        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 currentTime = block.timestamp;
        uint256 timeOfLastTrade = uint256(global.timeOfLastTrade);

        // if first trade of block
        if (currentTime > timeOfLastTrade) {
            int256 marketTWAP = poolTWAPOracle.getEURUSDTWAP();
            int256 indexTWAP = chainlinkTWAPOracle.getEURUSDTWAP();

            int256 latestTradePremium = LibMath.wadDiv(marketTWAP - indexTWAP, indexTWAP);
            int256 cumTradePremium = (currentTime - global.timeOfLastTrade).toInt256() * latestTradePremium;
            int256 timePassed = (currentTime - global.timeOfLastTrade).toInt256();
            global.cumFundingRate += (LibMath.wadMul(SENSITIVITY, cumTradePremium) * timePassed) / 1 days;

            global.timeOfLastTrade = uint128(currentTime);
        }
    }

    /// @notice Applies the funding payments on user.profit
    function _settleFundingRate(LibPerpetual.TraderPosition storage user, LibPerpetual.GlobalPosition storage global)
        internal
        returns (int256 upcomingFundingPayment)
    {
        if (user.openNotional != 0) {
            // update user variables when position opened before last update
            upcomingFundingPayment = getFundingPayments(user, global);
            emit Settlement(_msgSender(), uint128(block.timestamp), upcomingFundingPayment);
        }

        // update user variables to global state
        user.cumFundingRate = global.cumFundingRate;
    }

    /// @notice Calculate missed funding payments
    function getFundingPayments(LibPerpetual.TraderPosition memory user, LibPerpetual.GlobalPosition memory global)
        public
        pure
        returns (int256 upcomingFundingPayment)
    {
        /* Funding rates (as defined in our protocol) are paid from shorts to longs

            case 1: user is long => has missed receiving funding payments (positive or negative)
            case 2: user is short => has missed making funding payments (positive or negative)

            comment: Making an negative funding payment is equvalent to receiving a positive one.
        */
        int256 upcomingFundingRate = 0;
        if (user.cumFundingRate != global.cumFundingRate) {
            if (user.positionSize > 0) {
                upcomingFundingRate = global.cumFundingRate - user.cumFundingRate;
            } else {
                upcomingFundingRate = user.cumFundingRate - global.cumFundingRate;
            }
            upcomingFundingPayment = LibMath.wadDiv(upcomingFundingRate, user.openNotional);
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
        return chainlinkOracle.getIndexPrice();
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

    function marginIsValid(address account, int256 ratio) public view override returns (bool) {
        int256 marginRatioRes = marginRatio(account);
        return marginRatioRes >= ratio;
    }

    function marginRatio(address account) public view override returns (int256) {
        LibPerpetual.TraderPosition memory user = userPosition[account];
        LibPerpetual.GlobalPosition memory global = globalPosition;

        // margin ratio = (collateral + unrealizedPositionPnl + fundingPayments) / user.openNotional
        // all amounts should be expressed in vQuote/USD, otherwise the end result doesn't make sense
        int256 collateral = vault.getReserveValue(account);
        int256 fundingPayments = getFundingPayments(user, global);
        int256 unrealizedPositionPnl = getUnrealizedPositionPnl(user.positionSize, user.openNotional);

        int256 vQuoteVirtualProceeds = 0;
        int256 poolEURUSDTWAP = poolTWAPOracle.getEURUSDTWAP();
        if (user.side == LibPerpetual.Side.Long) {
            // vQuoteVirtualProceeds = market.get_dy(VBASE_INDEX, VQUOTE_INDEX, user.positionSize);
            vQuoteVirtualProceeds = LibMath.wadMul(user.positionSize.toInt256(), poolEURUSDTWAP);
        } else {
            // uint256 vBaseReceived = market.get_dy(VQUOTE_INDEX, VBASE_INDEX, user.positionSize);
            int256 vBaseReceived = LibMath.wadDiv(user.positionSize.toInt256(), poolEURUSDTWAP);

            int256 baseOnQuotePrice = indexPrice();
            vQuoteVirtualProceeds = LibMath.wadMul(vBaseReceived, baseOnQuotePrice);
        }

        int256 unrealizedPositionPnl = _calculatePnL(user.notional.toInt256(), vQuoteVirtualProceeds);

        return LibMath.wadDiv(collateral + unrealizedPositionPnl + fundingPayments, user.notional.toInt256());
    }

    function liquidate(address account) external {
        chainlinkTWAPOracle.updateEURUSDTWAP();
        poolTWAPOracle.updateEURUSDTWAP();
        updateFundingRate();

        require(!marginIsValid(account, MIN_MARGIN), "Margin is valid");
        address liquidator = _msgSender();

        // load information about state
        LibPerpetual.TraderPosition storage user = userPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 openNotional = uint256(user.openNotional); // TODO: is this safe??

        _closePosition(user, global);

        uint256 liquidationFeeAmount = LibMath.wadMul(openNotional, LIQUIDATION_FEE);

        // subtract fee from user account
        int256 reducedProfit = user.profit - liquidationFeeAmount.toInt256();
        vault.settleProfit(account, reducedProfit);

        // add fee to liquidator account
        vault.settleProfit(liquidator, liquidationFeeAmount.toInt256());

        emit LiquidationCall(account, liquidator, uint128(block.timestamp), openNotional);
    }

    // admin setter
    function mintTokens(uint256[2] calldata maxMintAmounts) external onlyOwner {
        vQuote.mint(maxMintAmounts[0]);
        vBase.mint(maxMintAmounts[1]);
    }
}
