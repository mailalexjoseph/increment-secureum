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
    int256 public constant MIN_MARGIN_AT_CREATION = MIN_MARGIN + FEE + 25e15; // initial margin is 2.5% + 3% + 2.5% = 8%
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

    uint256 internal totalLiquidityProvided;

    mapping(address => LibPerpetual.UserPosition) internal userPosition;

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
        require(vBase.approve(address(market), type(uint256).max));
        require(vQuote.approve(address(market), type(uint256).max));
    }

    // global getter
    function getLatestPrice() external view override returns (LibPerpetual.Price memory) {
        return getPrice(prices.length - 1);
    }

    function getPrice(uint256 period) public view override returns (LibPerpetual.Price memory) {
        return prices[period];
    }

    function getGlobalPosition() external view override returns (LibPerpetual.GlobalPosition memory) {
        return globalPosition;
    }

    // user getter
    function getUserPosition(address account) public view override returns (LibPerpetual.UserPosition memory) {
        return userPosition[account];
    }

    // functions. TODO: delete!
    function setPrice(LibPerpetual.Price memory newPrice) external override {
        prices.push(newPrice);
    }

    /// @notice Deposits tokens into the vault
    function deposit(uint256 amount, IERC20 token) external override {
        require(vault.deposit(_msgSender(), amount, token) > 0);
        emit Deposit(_msgSender(), address(token), amount);
    }

    /// @notice Withdraw tokens from the vault
    function withdraw(uint256 amount, IERC20 token) external override {
        //console.log("hardhat: try withdrawing collateral");
        require(getUserPosition(_msgSender()).openNotional == 0, "Has open position"); // TODO: can we loosen this restriction (i.e. check marginRatio in the end?)

        require(vault.withdraw(_msgSender(), amount, token) > 0);
        emit Withdraw(_msgSender(), address(token), amount);
    }

    function openPositionWithUSDC(uint256 amount, LibPerpetual.Side direction)
        external
        override
        returns (int256, int256)
    {
        // transform USDC amount with 6 decimals to a value with 18 decimals
        uint256 convertedWadAmount = LibReserve.tokenToWad(vault.getReserveTokenDecimals(), amount);

        return openPosition(convertedWadAmount, direction);
    }

    /// @notice Open position, long or short
    /// @param amount to be sold, in vQuote (if long) or vBase (if short)
    /// @dev No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGIN_AT_CREATION
    /// @dev No checks are done if bought amount exceeds allowance
    function openPosition(uint256 amount, LibPerpetual.Side direction) public override returns (int256, int256) {
        /*
            if amount > 0

                trader goes long EUR
                trader accrues openNotional debt
                trader receives positionSize assets

                openNotional = vQuote traded   to market   ( < 0)
                positionSize = vBase received from market ( > 0)

            else amount < 0

                trader goes short EUR
                trader receives openNotional assets
                trader accrues positionSize debt

                openNotional = vQuote received from market ( > 0)
                positionSize = vBase traded   to market   ( < 0)

        */

        address sender = _msgSender();

        require(amount > 0, "The amount can't be null");
        require(userPosition[sender].openNotional == 0, "Cannot open a position with one already opened");

        chainlinkTWAPOracle.updateEURUSDTWAP();
        poolTWAPOracle.updateEURUSDTWAP();
        updateFundingRate();

        // open position
        bool isLong = direction == LibPerpetual.Side.Long ? true : false;
        (int256 openNotional, int256 positionSize) = _openPosition(amount, isLong);

        // update position
        userPosition[sender] = LibPerpetual.UserPosition({
            openNotional: openNotional,
            positionSize: positionSize,
            cumFundingRate: globalPosition.cumFundingRate,
            liquidityBalance: 0,
            profit: 0
        });

        require(marginIsValid(sender, MIN_MARGIN_AT_CREATION), "Not enough margin");

        emit OpenPosition(sender, uint128(block.timestamp), direction, openNotional, positionSize);

        return (openNotional, positionSize);
    }

    function _openPosition(uint256 amount, bool isLong) internal returns (int256 openNotional, int256 positionSize) {
        /*  if long:
                openNotional = vQuote traded   to market   (or "- vQuote")
                positionSize = vBase  received from market (or "+ vBase")
            if short:
                openNotional = vQuote received from market (or "+ vQuote")
                positionSize = vBase  traded   to market   (or "- vBase")
        */

        if (isLong) {
            openNotional = -amount.toInt256();
            positionSize = _quoteForBase(amount, 0).toInt256();
        } else {
            openNotional = _baseForQuote(amount, 0).toInt256();
            positionSize = -amount.toInt256();
        }

        // console.log("hardhat: positionSize");
        // console.logInt(positionSize);
        // console.log("hardhat: openNotional");
        // console.logInt(openNotional);
    }

    /// @notice Closes position from account holder
    /// @param tentativeVQuoteAmount Amount of vQuote tokens to be sold for SHORT positions (anything works for LONG position)
    function closePosition(uint256 tentativeVQuoteAmount) public override {
        /*
        after opening the position:

            user has long position:
                openNotional = vQuote traded   to market   ( < 0)
                positionSize = vBase  received from market ( > 0)
            user has short position
                openNotional = vQuote received from market ( > 0)
                positionSize = vBase  traded   to market   ( < 0)

        to close the position:

            user has long position:
                @tentativeVQuoteAmount := can be anything, as it's not used to close LONG position
                => User trades the vBase tokens with the curve pool for vQuote tokens

            user has short position:
                @tentativeVQuoteAmount := amount of vQuote required to repay the vBase debt (an arbitrary amount)
                => User incurred vBase debt when opening a position and must now trade enough
                  vQuote with the curve pool to repay his vQuote debt in full.
                => Remaining balances can be traded with the market for vQuote.

                @audit Note that this mechanism can be exploited by inserting a large value here, since users
                will have to pay transaction fees anyways (on the curve pool).
        */
        LibPerpetual.UserPosition storage user = userPosition[_msgSender()];
        LibPerpetual.GlobalPosition storage global = globalPosition;
        require(user.openNotional != 0, "No position currently opened");

        chainlinkTWAPOracle.updateEURUSDTWAP();
        poolTWAPOracle.updateEURUSDTWAP();
        updateFundingRate();

        _closePosition(user, global, tentativeVQuoteAmount);

        // apply changes to collateral
        // TODO: do we want to settle with withdrawal instead?
        // i.e. https://github.com/MarkuSchick/perp/blob/2e85b00f9428567f1be8fb92fd1defb68c7bc7cf/contracts/Vault.sol#L122
        // this would
        vault.settleProfit(_msgSender(), user.profit);
        // TODO: only do that if tentativeVQuoteAmount is equal to all of the position of the user
        delete userPosition[_msgSender()];
    }

    /// @dev Used both by traders closing their own positions and liquidators liquidate other people's positions
    /// @notice user.profit is the sum of funding payments and the position PnL
    function _closePosition(
        LibPerpetual.UserPosition storage user,
        LibPerpetual.GlobalPosition storage global,
        uint256 tentativeVQuoteAmount
    ) internal {
        // update user.profit using funding payment info in the `global` struct
        // console.log("hardhat: user.profit before settlement");
        // console.logInt(user.profit);

        user.profit += _settleFundingRate(user, global);

        // console.log("hardhat: user.profit after settlement");
        // console.logInt(user.profit);
        // pnL of the position
        user.profit += _closePositionOnMarket(user.positionSize, tentativeVQuoteAmount) + user.openNotional;
    }

    /// @param tentativeVQuoteAmount is totally arbitrary. It's a value, hopefully, big
    /// enough to be able to close the short position
    function _closePositionOnMarket(int256 positionSize, uint256 tentativeVQuoteAmount)
        internal
        returns (int256 vQuoteProceeds)
    {
        bool isLong = positionSize > 0 ? true : false;
        uint256 position = isLong ? positionSize.toUint256() : (-positionSize).toUint256();
        if (isLong) {
            vBase.mint(position);
            uint256 amount = _baseForQuote(position, 0);
            vQuoteProceeds = amount.toInt256();
        } else {
            vQuote.mint(tentativeVQuoteAmount);
            uint256 vBaseProceeds = _quoteForBase(tentativeVQuoteAmount, 0);
            require(vBaseProceeds >= position, "Not enough returned");

            uint256 baseRemaining = vBaseProceeds - position;
            uint256 additionalProceeds = 0;
            // console.log("hardhat: Try to sell baseRemaining", baseRemaining);
            if (baseRemaining > 0) {
                // TODO: can we use a threshold here, where gas cost would exceed the additional revenue?
                // return remaining base to the vault
                try market.get_dy(VBASE_INDEX, VQUOTE_INDEX, baseRemaining) {
                    additionalProceeds = _baseForQuote(baseRemaining, 0);
                } catch {
                    // console.log("hardhat: Amount to sell is too low");
                }
            }
            // sell all remaining tokens
            vQuoteProceeds = -tentativeVQuoteAmount.toInt256() + additionalProceeds.toInt256();
        }
    }

    function _quoteForBase(uint256 quoteAmount, uint256 minAmount) internal returns (uint256) {
        // console.log("hardhat: quoteAmount is", quoteAmount);
        // console.log("hardhat: minAmount is", minAmount);

        // uint256 amountTest = market.get_dy(VQUOTE_INDEX, VBASE_INDEX, quoteAmount);
        // console.log("hardhat: get_dy returns", amountTest);
        vQuote.mint(quoteAmount);
        return market.exchange(VQUOTE_INDEX, VBASE_INDEX, quoteAmount, minAmount);
    }

    function _baseForQuote(uint256 baseAmount, uint256 minAmount) internal returns (uint256) {
        // console.log("hardhat: baseAmount is", baseAmount);
        // console.log("hardhat: minAmount is", minAmount);

        // uint256 amountTest = market.get_dy(VQUOTE_INDEX, VBASE_INDEX, baseAmount);
        // console.log("hardhat: get_dy returns", amountTest);
        vBase.mint(baseAmount);
        return market.exchange(VBASE_INDEX, VQUOTE_INDEX, baseAmount, minAmount);
    }

    /// @notice Calculate the funding rate for the current block

    function updateFundingRate() public {
        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 currentTime = block.timestamp;
        uint256 timeOfLastTrade = uint256(global.timeOfLastTrade);

        // if first trade of block
        //slither-disable-next-line timestamp
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
    function _settleFundingRate(LibPerpetual.UserPosition storage user, LibPerpetual.GlobalPosition storage global)
        internal
        returns (int256 upcomingFundingPayment)
    {
        if (user.openNotional != 0) {
            // update user variables when position opened before last update
            upcomingFundingPayment = getFundingPayments(user, global);
            emit Settlement(_msgSender(), upcomingFundingPayment);
        }

        // update user variables to global state
        user.cumFundingRate = global.cumFundingRate;
    }

    /// @notice Calculate missed funding payments
    //slither-disable-next-line timestamp
    function getFundingPayments(LibPerpetual.UserPosition memory user, LibPerpetual.GlobalPosition memory global)
        public
        view
        returns (int256 upcomingFundingPayment)
    {
        /* Funding rates (as defined in our protocol) are paid from longs to shorts

            case 1: user is long  => has missed making funding payments (positive or negative)
            case 2: user is short => has missed receiving funding payments (positive or negative)

            comment: Making an negative funding payment is equivalent to receiving a positive one.
        */
        int256 upcomingFundingRate = 0;
        //slither-disable-next-line timestamp
        if (user.cumFundingRate != global.cumFundingRate) {
            if (user.positionSize > 0) {
                upcomingFundingRate = user.cumFundingRate - global.cumFundingRate;
            } else {
                upcomingFundingRate = global.cumFundingRate - user.cumFundingRate;
            }
            // fundingPayments = fundingRate * openNotional
            upcomingFundingPayment = LibMath.wadMul(upcomingFundingRate, LibMath.abs(user.openNotional));
            // console.log("hardhat: upcomingFundingPayment: ");
            // console.logInt(upcomingFundingPayment);
        }
        return upcomingFundingPayment;
    }

    // @notice Return the current market price
    function marketPrice() public view returns (uint256) {
        return market.price_oracle(); // vBase / vQuote
    }

    // @notice Returns the simplified (x/y) market price (TODO: remove this)
    function realizedMarketPrice() external view returns (uint256) {
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
        require(userPosition[sender].liquidityBalance == 0, "Has provided liquidity before"); // TODO: can we loosen this restriction (must settle funding!)

        // split liquidity between long and short (TODO: account for value of liquidity provider already made)
        uint256 wadAmount = vault.deposit(_msgSender(), amount, token);

        uint256 basePrice;
        if (totalLiquidityProvided == 0) {
            basePrice = marketPrice();
            //console.log("hardhat: hardhat: has provided no liquidity");

            // note: To start the pool we first have to update the funding rate oracle!
            chainlinkTWAPOracle.updateEURUSDTWAP();
            poolTWAPOracle.updateEURUSDTWAP();
            updateFundingRate();
        } else {
            basePrice = LibMath.wadDiv(market.balances(0), market.balances(1));
            //console.log("hardhat: hardhat: has provided  liquidity");
        }
        uint256 baseAmount = LibMath.wadDiv(wadAmount, basePrice); // vQuote / vBase/vQuote  <=> 1 / 1.2 = 0.83

        //console.log("hardhat: hardhat: has wadAmount:", wadAmount);
        //console.log("hardhat: hardhat: has baseAmount:", baseAmount);

        // supply liquidity to curve pool
        vQuote.mint(wadAmount);
        vBase.mint(baseAmount);
        //uint256 min_mint_amount = 0; // set to zero for now
        uint256 liquidity = market.add_liquidity([wadAmount, baseAmount], 0); //  first token in curve pool is vQuote & second token is vBase

        // update balances
        userPosition[sender] = LibPerpetual.UserPosition({
            openNotional: -wadAmount.toInt256(),
            positionSize: -baseAmount.toInt256(),
            cumFundingRate: globalPosition.cumFundingRate,
            liquidityBalance: liquidity,
            profit: 0
        });
        totalLiquidityProvided += liquidity;

        emit LiquidityProvided(sender, address(token), amount);
        return (wadAmount, baseAmount);
    }

    /// @notice Withdraw liquidity from the pool
    /// @param amount of liquidity to be removed from the pool (with 18 decimals)
    /// @param  token to be removed from the pool
    function withdrawLiquidity(uint256 amount, IERC20 token) external override {
        // TODO: should we just hardcode amount here?
        address sender = _msgSender();
        //console.log("hardhat: hardhat: amount", amount);
        //console.log("hardhat: hardhat: userPosition[sender].liquidityBalance", userPosition[sender].liquidityBalance);

        LibPerpetual.UserPosition storage user = userPosition[sender];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        require(user.liquidityBalance == amount, "Not enough liquidity provided"); //TODO: can we loosen this?

        // lower balances
        user.liquidityBalance -= amount;
        totalLiquidityProvided -= amount;

        //console.log("hardhat: hardhat: trying to withdraw liquidity", amount);
        // remove liquidity from curve pool
        // calc_token_amount
        uint256 baseAmount;
        uint256 quoteAmount;
        {
            // to avoid stack to deep errors
            uint256 vQuoteBalanceBefore = vQuote.balanceOf(address(this)); // can we just assume 0 here? NO!
            uint256 vBaseBalanceBefore = vBase.balanceOf(address(this));

            //console.log("hardhat: hardhat vQuoteBalanceBefore", vQuoteBalanceBefore);
            //console.log("hardhat: hardhat vBaseBalanceBefore", vBaseBalanceBefore);

            market.remove_liquidity(amount, [uint256(0), uint256(0)]);

            uint256 vQuoteBalanceAfter = vQuote.balanceOf(address(this));
            uint256 vBaseBalanceAfter = vBase.balanceOf(address(this));

            //console.log("hardhat: hardhat vQuoteBalanceAfter", vQuoteBalanceAfter);
            //console.log("hardhat: hardhat vBaseBalanceAfter", vBaseBalanceAfter);

            quoteAmount = vQuoteBalanceAfter - vQuoteBalanceBefore;
            baseAmount = vBaseBalanceAfter - vBaseBalanceBefore;

            //console.log("hardhat: hardhat quoteAmount", quoteAmount);
            //console.log("hardhat: hardhat baseAmount", baseAmount);
        }
        //console.log("hardhat: hardhat: has withdrawn", vBaseAmount, vQuoteAmount);
        // console.log("hardhat: hardhat: ******before adjustments (withdraw liquidity)******");

        // console.log("hardhat: hardhat: user.cumFundingRate");
        // console.logInt(user.cumFundingRate);

        // console.log("hardhat: hardhat: user.profit");
        // console.logInt(user.profit);

        // console.log("hardhat: hardhat: user.openNotional");
        // console.logInt(user.openNotional);

        // console.log("hardhat: hardhat: user.positionSize");
        // console.logInt(user.positionSize);

        user.profit += _settleFundingRate(user, global);
        user.openNotional += quoteAmount.toInt256();
        user.positionSize += baseAmount.toInt256();

        // console.log("hardhat: hardhat: ******after adjustments (withdraw liquidity)******");
        // console.log("hardhat: hardhat: user.profit");
        // console.logInt(user.profit);

        // console.log("hardhat: hardhat: user.openNotional");
        // console.logInt(user.openNotional);

        require(vault.withdrawAll(sender, token) > 0); // TODO: withdraw all liquidity

        // if no open position remaining, remove the user
        if (user.positionSize == 0) {
            vault.settleProfit(sender, user.openNotional);
            vault.withdrawAll(sender, token);
            delete userPosition[sender];
        }

        emit LiquidityWithdrawn(sender, address(token), amount);
    }

    function marginIsValid(address account, int256 ratio) public view override returns (bool) {
        //slither-disable-next-line timestamp
        return marginRatio(account) <= ratio;
    }

    function marginRatio(address account) public view override returns (int256) {
        LibPerpetual.UserPosition memory user = userPosition[account];
        LibPerpetual.GlobalPosition memory global = globalPosition;

        // margin ratio = (collateral + unrealizedPositionPnl + fundingPayments) / user.openNotional
        // all amounts should be expressed in vQuote/USD, otherwise the end result doesn't make sense
        int256 collateral = vault.getReserveValue(account);
        int256 fundingPayments = getFundingPayments(user, global);

        int256 vQuoteVirtualProceeds = 0;
        int256 poolEURUSDTWAP = poolTWAPOracle.getEURUSDTWAP();
        if (user.positionSize > 0) {
            vQuoteVirtualProceeds = LibMath.wadMul(user.positionSize, poolEURUSDTWAP);
        } else {
            vQuoteVirtualProceeds = LibMath.wadMul(user.positionSize, poolEURUSDTWAP);
        }

        int256 unrealizedPositionPnl = user.openNotional + vQuoteVirtualProceeds;

        int256 positiveOpenNotional = LibMath.abs(user.openNotional);

        return LibMath.wadDiv(collateral + unrealizedPositionPnl + fundingPayments, positiveOpenNotional);
    }

    function liquidate(address account, uint256 amount) external {
        chainlinkTWAPOracle.updateEURUSDTWAP();
        poolTWAPOracle.updateEURUSDTWAP();
        updateFundingRate();

        require(!marginIsValid(account, MIN_MARGIN), "Margin is valid");
        address liquidator = _msgSender();

        // TODO: require amount is fair price
        // load information about state
        LibPerpetual.UserPosition storage user = userPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 openNotional = uint256(user.openNotional); // TODO: is this safe??

        _closePosition(user, global, amount);

        uint256 liquidationFeeAmount = LibMath.wadMul(openNotional, LIQUIDATION_FEE);

        // subtract fee from user account
        int256 reducedProfit = user.profit - liquidationFeeAmount.toInt256();
        vault.settleProfit(account, reducedProfit);

        // add fee to liquidator account
        vault.settleProfit(liquidator, liquidationFeeAmount.toInt256());

        emit LiquidationCall(account, liquidator, uint128(block.timestamp), openNotional);
    }
}
