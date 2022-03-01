// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// interfaces
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {ITwapOracle} from "./interfaces/ITwapOracle.sol";
import {IVBase} from "./interfaces/IVBase.sol";
import {IVQuote} from "./interfaces/IVQuote.sol";
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";
import {IClearingHouse} from "./interfaces/IClearingHouse.sol";

// libraries
import {LibMath} from "./lib/LibMath.sol";
import {LibPerpetual} from "./lib/LibPerpetual.sol";

import "hardhat/console.sol";

contract Perpetual is IPerpetual, ITwapOracle, Context {
    using SafeCast for uint256;
    using SafeCast for int256;

    // parameterization
    uint256 public constant TWAP_FREQUENCY = 15 minutes; // time after which funding rate CAN be calculated
    uint256 public constant VQUOTE_INDEX = 0;
    uint256 public constant VBASE_INDEX = 1;
    int256 public constant SENSITIVITY = 1e18; // funding rate sensitivity to price deviations

    // dependencies
    IVBase public override vBase;
    IVQuote public override vQuote;
    IClearingHouse public override clearingHouse;
    ICryptoSwap public override market;

    // global state
    LibPerpetual.GlobalPosition internal globalPosition;
    uint256 internal totalLiquidityProvided;
    uint256 internal vBaseDust;

    int256 public oracleCumulativeAmount;
    int256 public oracleCumulativeAmountAtBeginningOfPeriod;
    int256 public oracleTwap;

    int256 public marketCumulativeAmount;
    // slither-disable-next-line similar-names
    int256 public marketCumulativeAmountAtBeginningOfPeriod;
    int256 public marketTwap;

    // user state
    mapping(address => LibPerpetual.UserPosition) internal traderPosition;
    mapping(address => LibPerpetual.UserPosition) internal lpPosition;

    constructor(
        IVBase _vBase,
        IVQuote _vQuote,
        ICryptoSwap _market,
        IClearingHouse _clearingHouse
    ) {
        // TODO: address zero checks
        vBase = _vBase;
        vQuote = _vQuote;
        market = _market;
        clearingHouse = _clearingHouse;

        // approve all future transfers between Perpetual and market (curve pool)
        require(vBase.approve(address(market), type(uint256).max), "NO APPROVAL. TODO: PLZ CHANGE THIS TO DURING CALL");
        require(vQuote.approve(address(market), type(uint256).max), "NO APPROVAL");

        // can't access immutable variables in the constructor
        int256 lastChainlinkPrice = IVBase(_vBase).getIndexPrice();
        int256 lastMarketPrice = ICryptoSwap(_market).last_prices().toInt256();

        // initialize the oracle
        oracleTwap = lastChainlinkPrice;
        marketTwap = lastMarketPrice;

        globalPosition.timeOfLastTrade = uint128(block.timestamp);
        globalPosition.timeOfLastFunding = uint128(block.timestamp);
    }

    modifier onlyClearingHouse() {
        require(msg.sender == address(clearingHouse), "Only clearing house can call this function");
        _;
    }

    ///// TRADING FLOW OPERATIONS \\\\\

    /// @notice Open position, long or short
    /// @param amount to be sold, in vQuote (if long) or vBase (if short)
    /// @dev No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGIN_AT_CREATION
    /// @dev No checks are done if bought amount exceeds allowance
    function openPosition(
        address account,
        uint256 amount,
        LibPerpetual.Side direction,
        uint256 minAmount
    ) external override onlyClearingHouse returns (int256, int256) {
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

        require(amount > 0, "The amount can't be null");
        // slither-disable-next-line timestamp // TODO: sounds incorrect
        require(
            traderPosition[account].openNotional == 0,
            "Cannot open a position with one already opened or liquidity provided"
        );

        updateGenericProtocolState();

        // open position
        bool isLong = direction == LibPerpetual.Side.Long ? true : false;
        (int256 openNotional, int256 positionSize) = _openPosition(amount, isLong, minAmount);

        // update position
        traderPosition[account] = LibPerpetual.UserPosition({
            openNotional: openNotional,
            positionSize: positionSize,
            cumFundingRate: globalPosition.cumFundingRate,
            liquidityBalance: 0
        });

        return (openNotional, positionSize);
    }

    function _openPosition(
        uint256 amount,
        bool isLong,
        uint256 minAmount
    ) internal returns (int256 openNotional, int256 positionSize) {
        /*  if long:
                openNotional = vQuote traded   to market   (or "- vQuote")
                positionSize = vBase  received from market (or "+ vBase")
            if short:
                openNotional = vQuote received from market (or "+ vQuote")
                positionSize = vBase  traded   to market   (or "- vBase")
        */

        if (isLong) {
            openNotional = -amount.toInt256();
            positionSize = _quoteForBase(amount, minAmount).toInt256();
        } else {
            openNotional = _baseForQuote(amount, minAmount).toInt256();
            positionSize = -amount.toInt256();
        }
    }

    /// @notice Closes position from account holder
    /// @param tentativeVQuoteAmount Amount of vQuote tokens to be sold for SHORT positions (anything works for LONG position)
    function closePosition(
        address account,
        uint256 tentativeVQuoteAmount,
        uint256 minAmount
    ) external override returns (int256) {
        /*
        after opening the position:

            trader has long position:
                openNotional = vQuote traded   to market   ( < 0)
                positionSize = vBase  received from market ( > 0)
            trader has short position
                openNotional = vQuote received from market ( > 0)
                positionSize = vBase  traded   to market   ( < 0)

        to close the position:

            trader has long position:
                @tentativeVQuoteAmount := can be anything, as it's not used to close LONG position
                => User trades the vBase tokens with the curve pool for vQuote tokens

            trader has short position:
                @tentativeVQuoteAmount := amount of vQuote required to repay the vBase debt (an arbitrary amount)
                => User incurred vBase debt when opening a position and must now trade enough
                  vQuote with the curve pool to repay his vQuote debt in full.
                => Remaining balances can be traded with the market for vQuote.

                @audit Note that this mechanism can be exploited by inserting a large value here, since traders
                will have to pay transaction fees anyways (on the curve pool).
        */
        LibPerpetual.UserPosition storage trader = traderPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;
        require(trader.openNotional != 0, "No position currently opened");

        updateGenericProtocolState();

        int256 profit = _closePosition(trader, global, tentativeVQuoteAmount, minAmount);

        delete traderPosition[account];

        return profit;
    }

    function getUnrealizedPnL(address account) external view override returns (int256) {
        LibPerpetual.UserPosition memory trader = traderPosition[account];
        int256 poolEURUSDTWAP = getMarketTwap();
        int256 vQuoteVirtualProceeds = LibMath.wadMul(trader.positionSize, poolEURUSDTWAP);

        // in the case of a LONG, trader.openNotional is negative but vQuoteVirtualProceeds is positive
        // in the case of a SHORT, trader.openNotional is positive while vQuoteVirtualProceeds is negative
        return trader.openNotional + vQuoteVirtualProceeds;
    }

    /// @param tentativeVQuoteAmount Amount of vQuote tokens to be sold for SHORT positions (anything works for LONG position)
    function liquidate(address liquidatee, uint256 tentativeVQuoteAmount) external onlyClearingHouse returns (int256) {
        updateGenericProtocolState();

        // load information about state
        LibPerpetual.UserPosition storage trader = traderPosition[liquidatee];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        int256 profit = _closePosition(trader, global, tentativeVQuoteAmount, 0);

        return profit;
    }

    ///// LIQUIDITY PROVISIONING FLOW OPERATIONS \\\\\

    /// @notice Provide liquidity to the pool
    /// @param account liquidity provider
    /// @param  wadAmount amount of vQuote provided with 1e18 precision
    function provideLiquidity(address account, uint256 wadAmount)
        external
        override
        onlyClearingHouse
        returns (uint256)
    {
        // slither-disable-next-line timestamp // TODO: sounds incorrect
        require(wadAmount != 0, "Zero amount");
        // slither-disable-next-line timestamp // TODO: sounds incorrect
        require(lpPosition[account].liquidityBalance == 0, "Has provided liquidity before"); // TODO: can we loosen this restriction (must settle funding!)

        uint256 basePrice;
        if (totalLiquidityProvided == 0) {
            basePrice = marketPrice();

            // note: To start the pool we first have to update the funding rate oracle!
            updateGenericProtocolState();
        } else {
            basePrice = LibMath.wadDiv(market.balances(0), market.balances(1));
        }
        uint256 baseAmount = LibMath.wadDiv(wadAmount, basePrice); // vQuote / vBase/vQuote  <=> 1 / 1.2 = 0.83

        // supply liquidity to curve pool
        vQuote.mint(wadAmount);
        vBase.mint(baseAmount);
        //uint256 min_mint_amount = 0; // set to zero for now
        uint256 liquidity = market.add_liquidity([wadAmount, baseAmount], 0); //  first token in curve pool is vQuote & second token is vBase

        // update balances
        lpPosition[account] = LibPerpetual.UserPosition({
            openNotional: -wadAmount.toInt256(),
            positionSize: -baseAmount.toInt256(),
            cumFundingRate: globalPosition.cumFundingRate,
            liquidityBalance: liquidity
        });
        totalLiquidityProvided += liquidity;

        return baseAmount;
    }

    /// @notice Remove liquidity from the pool (but don't close LP position and withdraw amount)
    /// @param amount of liquidity to be removed from the pool (with 18 decimals)
    function removeLiquidity(address account, uint256 amount) external override onlyClearingHouse {
        // TODO: should we just hardcode amount here?
        LibPerpetual.UserPosition storage lp = lpPosition[account];

        // slither-disable-next-line incorrect-equality
        require(amount <= lp.liquidityBalance, "Not enough liquidity provided"); //TODO: can we loosen this?

        // lower balances
        lp.liquidityBalance -= amount;
        totalLiquidityProvided -= amount;

        // remove liquidity from curve pool
        uint256 baseAmount;
        uint256 quoteAmount;
        {
            // to avoid stack to deep errors
            uint256 vQuoteBalanceBefore = vQuote.balanceOf(address(this)); // can we just assume 0 here? NO!
            uint256 vBaseBalanceBefore = vBase.balanceOf(address(this));

            market.remove_liquidity(amount, [uint256(0), uint256(0)]);

            uint256 vQuoteBalanceAfter = vQuote.balanceOf(address(this));
            uint256 vBaseBalanceAfter = vBase.balanceOf(address(this));

            quoteAmount = vQuoteBalanceAfter - vQuoteBalanceBefore;
            baseAmount = vBaseBalanceAfter - vBaseBalanceBefore;

            vQuote.burn(quoteAmount);
            vBase.burn(baseAmount);
        }

        // add the amounts received from the pool
        lp.openNotional += quoteAmount.toInt256();
        lp.positionSize += baseAmount.toInt256();
    }

    /// @notice Remove liquidity from the pool (but don't close LP position and withdraw amount).
    /// @notice Separated from `removeLiquidity` because `tentativeVQuoteAmount` can't guessed at the moment when user calls `removeLiquidity`
    /// @param tentativeVQuoteAmount at which to buy the LP position (if it looks like a short, more vQuote than vBase). 18 decimals
    function settleAndWithdrawLiquidity(address account, uint256 tentativeVQuoteAmount)
        external
        override
        onlyClearingHouse
        returns (int256 profit)
    {
        LibPerpetual.UserPosition storage lp = lpPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        updateGenericProtocolState();

        // profit = pnl + fundingPayments
        profit = _closePosition(lp, global, tentativeVQuoteAmount, 0);

        delete lpPosition[account];
    }

    ///// COMMON OPERATIONS \\\\\

    function _updateFundingRate() internal {
        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 currentTime = block.timestamp;

        int256 marketTWAP = getMarketTwap();
        int256 indexTWAP = getOracleTwap();

        // console.log("marketTWAP: twapOracle");
        // console.logInt(marketTWAP);

        // console.log("indexTWAP: twapOracle");
        // console.logInt(indexTWAP);

        // console.log("marketTWAP: poolTWAPOracle");
        // console.logInt(poolTWAPOracle.getEURUSDTWAP());

        // console.log("indexTWAP: chainlinkTWAPOracle");
        // console.logInt(chainlinkTWAPOracle.getEURUSDTWAP());

        int256 currentTraderPremium = LibMath.wadDiv(marketTWAP - indexTWAP, indexTWAP);
        int256 timePassedSinceLastTrade = (currentTime - global.timeOfLastTrade).toInt256();
        int256 weightedTradePremiumOverLastPeriod = timePassedSinceLastTrade * currentTraderPremium;

        global.cumFundingRate +=
            (LibMath.wadMul(SENSITIVITY, weightedTradePremiumOverLastPeriod) * timePassedSinceLastTrade) /
            1 days;

        global.timeOfLastTrade = uint128(currentTime);
    }

    /// @notice Applies the funding payments on the profit
    function _settleFundingRate(LibPerpetual.UserPosition storage user, LibPerpetual.GlobalPosition storage global)
        internal
        returns (int256 upcomingFundingPayment)
    {
        if (user.openNotional != 0) {
            // update user variables when position opened before last update
            upcomingFundingPayment = _getFundingPayments(user, global);
            emit Settlement(_msgSender(), upcomingFundingPayment);
        }

        user.cumFundingRate = global.cumFundingRate;
    }

    function getFundingPayments(address account) external view override returns (int256) {
        LibPerpetual.UserPosition memory user = traderPosition[account];
        LibPerpetual.GlobalPosition memory global = globalPosition;
        return _getFundingPayments(user, global);
    }

    /// @notice Calculate missed funding payments
    // slither-disable-next-line timestamp
    function _getFundingPayments(LibPerpetual.UserPosition memory user, LibPerpetual.GlobalPosition memory global)
        internal
        pure
        returns (int256 upcomingFundingPayment)
    {
        /* Funding rates (as defined in our protocol) are paid from longs to shorts

            case 1: user is long  => has missed making funding payments (positive or negative)
            case 2: user is short => has missed receiving funding payments (positive or negative)

            comment: Making an negative funding payment is equivalent to receiving a positive one.
        */
        int256 upcomingFundingRate = 0;

        bool isLong = user.positionSize > 0 ? true : false;
        // slither-disable-next-line timestamp
        if (user.cumFundingRate != global.cumFundingRate) {
            if (isLong) {
                upcomingFundingRate = user.cumFundingRate - global.cumFundingRate;
            } else {
                upcomingFundingRate = global.cumFundingRate - user.cumFundingRate;
            }
            // fundingPayments = fundingRate * openNotional
            upcomingFundingPayment = LibMath.wadMul(upcomingFundingRate, LibMath.abs(user.openNotional));
        }
        return upcomingFundingPayment;
    }

    function updateGenericProtocolState() public {
        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 currentTime = block.timestamp;
        uint256 timeOfLastTrade = uint256(global.timeOfLastTrade);

        // Don't update the state more than once per block
        // slither-disable-next-line timestamp
        if (currentTime > timeOfLastTrade) {
            updateTwap();
            _updateFundingRate();
        }
    }

    function updateTwap() public override {
        uint256 currentTime = block.timestamp;
        int256 timeElapsed = (currentTime - globalPosition.timeOfLastTrade).toInt256();

        /*
            priceCumulative1 = priceCumulative0 + price1 * timeElapsed
        */

        // update cumulative chainlink price feed
        int256 latestChainlinkPrice = indexPrice();
        oracleCumulativeAmount = oracleCumulativeAmount + latestChainlinkPrice * timeElapsed;

        // update cumulative market price feed
        int256 latestMarketPrice = marketPrice().toInt256();
        marketCumulativeAmount = marketCumulativeAmount + latestMarketPrice * timeElapsed;

        uint256 timeElapsedSinceBeginningOfPeriod = block.timestamp - globalPosition.timeOfLastFunding;

        // slither-disable-next-line timestamp
        if (timeElapsedSinceBeginningOfPeriod >= TWAP_FREQUENCY) {
            /*
                TWAP = (priceCumulative1 - priceCumulative0) / timeElapsed
            */

            // calculate chainlink twap
            oracleTwap =
                (oracleCumulativeAmount - oracleCumulativeAmountAtBeginningOfPeriod) /
                timeElapsedSinceBeginningOfPeriod.toInt256();

            // calculate market twap
            marketTwap =
                (marketCumulativeAmount - marketCumulativeAmountAtBeginningOfPeriod) /
                timeElapsedSinceBeginningOfPeriod.toInt256();

            // reset cumulative amount and timestamp
            oracleCumulativeAmountAtBeginningOfPeriod = oracleCumulativeAmount;
            marketCumulativeAmountAtBeginningOfPeriod = marketCumulativeAmount;
            globalPosition.timeOfLastFunding = uint128(block.timestamp);

            emit TwapUpdated(block.timestamp, oracleTwap, marketTwap);
        }
    }

    /// @dev Used both by traders closing their own positions and liquidators liquidating other people's positions
    /// @notice profit is the sum of funding payments and the position PnL
    // slither-disable-next-line timestamp // TODO: sounds incorrect
    function _closePosition(
        LibPerpetual.UserPosition storage user,
        LibPerpetual.GlobalPosition storage global,
        uint256 tentativeVQuoteAmount,
        uint256 minAmount
    ) internal returns (int256 profit) {
        bool isShort = user.positionSize < 0 ? true : false;
        if (isShort) {
            // check that `tentativeVQuoteAmount` isn't too far from the value in the market
            // to avoid creating large swings in the market (even though these swings would be cancelled out
            // by the fact that we sell any extra vBase bought)
            int256 marketEURUSDTWAP = getMarketTwap();
            // USD_amount = EUR_USD * EUR_amount
            int256 positivePositionSize = -user.positionSize;
            int256 reasonableVQuoteAmount = LibMath.wadMul(marketEURUSDTWAP, positivePositionSize);

            int256 deviation = LibMath.wadDiv(
                LibMath.abs(tentativeVQuoteAmount.toInt256() - reasonableVQuoteAmount),
                reasonableVQuoteAmount
            );

            // Allow for a 50% deviation from the market vQuote TWAP price to close this position
            require(deviation < 5e17, "Amount submitted too far from the market price of the position");
        }

        // update profit using funding payment info in the `global` struct
        profit += _settleFundingRate(user, global);

        // pnL of the position
        profit += _closePositionOnMarket(user.positionSize, tentativeVQuoteAmount, minAmount) + user.openNotional;
    }

    function _canSellBase(uint256 sellAmount) internal returns (bool) {
        // slither-disable-next-line unused-return
        try market.get_dy(VBASE_INDEX, VQUOTE_INDEX, sellAmount) {
            return true;
        } catch {
            emit Log("Swap impossible");

            return false;
        }
    }

    /// TODO: find a way to withdraw the dust
    function getBaseDust() external view returns (uint256) {
        return vBaseDust;
    }

    /// @param tentativeVQuoteAmount arbitrary value, hopefully, big enough to be able to close the short position
    function _closePositionOnMarket(
        int256 positionSize,
        uint256 tentativeVQuoteAmount,
        uint256 minAmount
    ) internal returns (int256 vQuoteProceeds) {
        bool isLong = positionSize > 0 ? true : false;
        uint256 position = isLong ? positionSize.toUint256() : (-positionSize).toUint256();
        if (isLong) {
            uint256 amount = _baseForQuote(position, minAmount);
            vQuoteProceeds = amount.toInt256();
        } else {
            uint256 vBaseProceeds = _quoteForBase(tentativeVQuoteAmount, minAmount);

            require(vBaseProceeds >= position, "Not enough returned, proposed amount too low");

            // have to sell remaining tokens
            uint256 baseRemaining = vBaseProceeds - position;
            uint256 additionalProceeds = 0;
            if (baseRemaining > 0) {
                if (_canSellBase(baseRemaining)) {
                    additionalProceeds = _baseForQuote(baseRemaining, 0);
                } else {
                    // dust vBase balance can not be sold
                    emit DustGenerated(baseRemaining);
                    vBaseDust += baseRemaining;
                }
            }
            // sell all remaining tokens
            vQuoteProceeds = -tentativeVQuoteAmount.toInt256() + additionalProceeds.toInt256();
        }
    }

    function _quoteForBase(uint256 quoteAmount, uint256 minAmount) internal returns (uint256) {
        // slither-disable-next-line unused-return
        vQuote.mint(quoteAmount);
        uint256 vBaseReceived = market.exchange(VQUOTE_INDEX, VBASE_INDEX, quoteAmount, minAmount);
        vBase.burn(vBaseReceived);
        return vBaseReceived;
    }

    function _baseForQuote(uint256 baseAmount, uint256 minAmount) internal returns (uint256) {
        // slither-disable-next-line unused-retur
        vBase.mint(baseAmount);
        uint256 vQuoteReceived = market.exchange(VBASE_INDEX, VQUOTE_INDEX, baseAmount, minAmount);
        vQuote.burn(vQuoteReceived);
        return vQuoteReceived;
    }

    /// @notice Return amount for vBase one would receive for exchanging `vQuoteAmountToSpend` (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `openPosition`
    function getExpectedVBaseAmount(uint256 vQuoteAmountToSpend) external view override returns (uint256) {
        return market.get_dy(VQUOTE_INDEX, VBASE_INDEX, vQuoteAmountToSpend);
    }

    /// @notice Return amount for vQuote one would receive for exchanging `vBaseAmountToSpend` (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `openPosition`
    function getExpectedVQuoteAmount(uint256 vBaseAmountToSpend) external view override returns (uint256) {
        return market.get_dy(VBASE_INDEX, VQUOTE_INDEX, vBaseAmountToSpend);
    }

    /// @notice Return the curve price oracle
    function marketPriceOracle() external view override returns (uint256) {
        return market.price_oracle();
    }

    /// @notice Return the last traded price (used for TWAP)
    function marketPrice() public view override returns (uint256) {
        return market.last_prices();
    }

    /// @notice Return the current off-chain exchange rate for vBase/vQuote
    function indexPrice() public view override returns (int256) {
        return vBase.getIndexPrice();
    }

    function getGlobalPosition() external view override returns (LibPerpetual.GlobalPosition memory) {
        return globalPosition;
    }

    function getTraderPosition(address account) external view override returns (LibPerpetual.UserPosition memory) {
        return traderPosition[account];
    }

    function getLpPosition(address account) external view override returns (LibPerpetual.UserPosition memory) {
        return lpPosition[account];
    }

    function getOracleTwap() public view override returns (int256) {
        return oracleTwap;
    }

    function getMarketTwap() public view override returns (int256) {
        return marketTwap;
    }
}
