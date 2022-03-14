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
        require(address(_vBase) != address(0), "vBase cannot be 0");
        require(address(_vQuote) != address(0), "vQuote cannot be 0");
        require(address(_market) != address(0), "market cannot be 0");
        require(address(_clearingHouse) != address(0), "ClearingHouse cannot be 0");

        vBase = _vBase;
        vQuote = _vQuote;
        market = _market;
        clearingHouse = _clearingHouse;

        // approve all future transfers between Perpetual and market (curve pool)
        require(vBase.approve(address(market), type(uint256).max), "NO APPROVAL. TODO: PLZ CHANGE THIS TO DURING CALL");
        require(vQuote.approve(address(market), type(uint256).max), "NO APPROVAL");

        // initialize global state
        _initGlobalState(IVBase(_vBase).getIndexPrice(), ICryptoSwap(_market).last_prices().toInt256());
    }

    function _initGlobalState(int256 lastChainlinkPrice, int256 lastMarketPrice) internal {
        // initialize twap
        oracleTwap = lastChainlinkPrice;
        marketTwap = lastMarketPrice;

        // initialize funding
        globalPosition = LibPerpetual.GlobalPosition({
            timeOfLastTrade: uint128(block.timestamp),
            timeOfLastFunding: uint128(block.timestamp),
            cumFundingRate: 0,
            blockStartPrice: lastMarketPrice
        });
    }

    modifier onlyClearingHouse() {
        require(msg.sender == address(clearingHouse), "Only clearing house can call this function");
        _;
    }

    ///// TRADING FLOW OPERATIONS \\\\\

    /// @notice Open or increase a position, either long or short
    /// @param amount to be sold, in vQuote (if long) or vBase (if short)
    /// @dev No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGIN_AT_CREATION
    /// @dev No checks are done if bought amount exceeds allowance
    function extendPosition(
        address account,
        uint256 amount,
        LibPerpetual.Side direction,
        uint256 minAmount
    )
        external
        override
        onlyClearingHouse
        returns (
            int256,
            int256,
            int256
        )
    {
        /*
            if direction = LONG

                trader goes long EUR
                trader accrues openNotional debt
                trader receives positionSize assets

                openNotional = vQuote traded   to market   ( < 0)
                positionSize = vBase received from market ( > 0)

            else direction = SHORT

                trader goes short EUR
                trader receives openNotional assets
                trader accrues positionSize debt

                openNotional = vQuote received from market ( > 0)
                positionSize = vBase traded   to market   ( < 0)

        */
        LibPerpetual.UserPosition storage trader = traderPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        bool isLong = direction == LibPerpetual.Side.Long ? true : false;

        // make sure trader doesn't try to use `extendPosition` to reduce a position
        // to skip the settlement of due funding payments
        if (isLong) {
            require(
                traderPosition[account].positionSize >= 0,
                "Cannot reduce/close a SHORT position by opening a LONG position"
            );
        } else {
            require(
                traderPosition[account].positionSize <= 0,
                "Cannot reduce/close a LONG position by opening a SHORT position"
            );
        }

        // update state
        updateTwapAndFundingRate();

        // open position
        (int256 openNotional, int256 positionSize) = _extendPosition(amount, isLong, minAmount);

        // check max deviation
        checkPriceDeviation();

        // apply funding rate on existing positionSize
        int256 fundingPayments = _getFundingPayments(
            isLong,
            trader.cumFundingRate,
            global.cumFundingRate,
            LibMath.abs(trader.positionSize)
        );

        // update position
        trader.openNotional += openNotional;
        trader.positionSize += positionSize;
        trader.cumFundingRate = global.cumFundingRate;

        return (openNotional, positionSize, fundingPayments);
    }

    function _extendPosition(
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
    /// @param account Trader account to close position for.
    /// @param reductionRatio Percentage of the position that the user wishes to close. Min: 0. Max: 1e18
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    function reducePosition(
        address account,
        uint256 reductionRatio,
        uint256 proposedAmount,
        uint256 minAmount
    )
        external
        override
        returns (
            int256,
            int256,
            int256
        )
    {
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
                @proposedAmount := can be anything, as it's not used to close LONG position
                => User trades the vBase tokens with the curve pool for vQuote tokens

            trader has short position:
                @proposedAmount := amount of vQuote required to repay the vBase debt (an arbitrary amount)
                => User incurred vBase debt when opening a position and must now trade enough
                  vQuote with the curve pool to repay his vQuote debt in full.
                => Remaining balances can be traded with the market for vQuote.

                @audit Note that this mechanism can be exploited by inserting a large value here, since traders
                will have to pay transaction fees anyways (on the curve pool).
        */
        LibPerpetual.UserPosition storage trader = traderPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        require(trader.openNotional != 0 || trader.positionSize != 0, "No position currently opened in this market");

        // update state
        updateTwapAndFundingRate();

        (int256 vBaseAmount, int256 vQuoteProceeds, int256 profit) = _reducePosition(
            trader,
            global,
            reductionRatio,
            proposedAmount,
            minAmount
        );

        // check max deviation
        checkPriceDeviation();

        // adjust trader position
        trader.openNotional += vQuoteProceeds;
        trader.positionSize += vBaseAmount;

        // if position has been closed entirely, delete it from the state
        if (trader.positionSize == 0) {
            delete traderPosition[account];
        }

        return (vQuoteProceeds, vBaseAmount, profit);
    }

    function checkPriceDeviation() internal view {
        // check if market price has changed more than by 2% in this block

        int256 newPrice = marketPrice().toInt256();
        // price deviations of a given block does not exceed 2%
        // <=> 2% > (newPrice - currentPrice) / newPrice
        // 2 * newPrice > (oldPrice - currentPrice) * 100

        // slither-disable-next-line incorrect-equality
        require(
            2e16 * newPrice > LibMath.abs(newPrice - globalPosition.blockStartPrice) * 10e18,
            "Price impact too large"
        );
    }

    function getUnrealizedPnL(address account) external view override returns (int256) {
        LibPerpetual.UserPosition memory trader = traderPosition[account];
        int256 poolEURUSDTWAP = getMarketTwap();
        int256 vQuoteVirtualProceeds = LibMath.wadMul(trader.positionSize, poolEURUSDTWAP);

        // in the case of a LONG, trader.openNotional is negative but vQuoteVirtualProceeds is positive
        // in the case of a SHORT, trader.openNotional is positive while vQuoteVirtualProceeds is negative
        return trader.openNotional + vQuoteVirtualProceeds;
    }

    ///// LIQUIDITY PROVISIONING FLOW OPERATIONS \\\\\

    /// @notice Provide liquidity to the pool
    /// @param account liquidity provider
    /// @param  wadAmount amount of vQuote provided with 1e18 precision
    function provideLiquidity(address account, uint256 wadAmount)
        external
        override
        onlyClearingHouse
        returns (uint256, int256)
    {
        updateTwapAndFundingRate();

        // reflect the added liquidity on the LP position
        LibPerpetual.UserPosition storage lp = lpPosition[account];

        int256 fundingPayments;
        if (lp.cumFundingRate != globalPosition.cumFundingRate && lp.cumFundingRate != 0) {
            bool isLong = _getPositionDirection(lp);

            fundingPayments = _getFundingPayments(
                isLong,
                lp.cumFundingRate,
                globalPosition.cumFundingRate,
                LibMath.abs(lp.positionSize)
            );
        }

        uint256 basePrice;
        if (totalLiquidityProvided == 0) {
            basePrice = marketPrice();
        } else {
            basePrice = LibMath.wadDiv(market.balances(0), market.balances(1));
        }
        uint256 baseAmount = LibMath.wadDiv(wadAmount, basePrice); // vQuote / vBase/vQuote  <=> 1 / 1.2 = 0.83

        // supply liquidity to curve pool
        vQuote.mint(wadAmount);
        vBase.mint(baseAmount);
        //uint256 min_mint_amount = 0; // set to zero for now
        uint256 liquidity = market.add_liquidity([wadAmount, baseAmount], 0); //  first token in curve pool is vQuote & second token is vBase

        lp.openNotional -= wadAmount.toInt256();
        lp.positionSize -= baseAmount.toInt256();
        lp.cumFundingRate = globalPosition.cumFundingRate;
        lp.liquidityBalance += liquidity;
        totalLiquidityProvided += liquidity;

        return (baseAmount, fundingPayments);
    }

    /// @notice Remove liquidity from the pool
    /// @param account Account of the LP to remove liquidity from
    /// @param liquidityAmountToRemove Amount of liquidity to be removed from the pool. 18 decimals
    /// @param reductionRatio Percentage of the position that the user wishes to close. Min: 0. Max: 1e18
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    function removeLiquidity(
        address account,
        uint256 liquidityAmountToRemove,
        uint256 reductionRatio,
        uint256 proposedAmount,
        uint256 minAmount
    )
        external
        override
        onlyClearingHouse
        returns (
            int256,
            int256,
            int256
        )
    {
        LibPerpetual.UserPosition storage lp = lpPosition[account];

        updateTwapAndFundingRate();

        // slither-disable-next-line incorrect-equality
        require(liquidityAmountToRemove <= lp.liquidityBalance, "Cannot remove more liquidity than LP provided");

        // lower balances
        lp.liquidityBalance -= liquidityAmountToRemove;
        totalLiquidityProvided -= liquidityAmountToRemove;

        // remove liquidity from curve pool
        uint256 baseAmount;
        uint256 quoteAmount;
        {
            // to avoid stack too deep errors
            uint256 vQuoteBalanceBefore = vQuote.balanceOf(address(this)); // can we just assume 0 here? NO!
            uint256 vBaseBalanceBefore = vBase.balanceOf(address(this));

            market.remove_liquidity(liquidityAmountToRemove, [uint256(0), uint256(0)]);

            require(vQuote.balanceOf(address(market)) > 0, "You broke the market");
            require(vBase.balanceOf(address(market)) > 0, "You broke the market");

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

        // profit = pnl + fundingPayments
        (int256 vBaseAmount, int256 vQuoteProceeds, int256 profit) = _reducePosition(
            lp,
            globalPosition,
            reductionRatio,
            proposedAmount,
            minAmount
        );

        // check max deviation
        checkPriceDeviation();

        // adjust lp position
        lp.openNotional += vQuoteProceeds;
        lp.positionSize += vBaseAmount;

        // if position has been closed entirely, delete it from the state
        // slither-disable-next-line incorrect-equality
        if (lp.positionSize == 0 && lp.liquidityBalance == 0) {
            delete lpPosition[account];
        }

        return (vQuoteProceeds, vBaseAmount, profit);
    }

    ///// COMMON OPERATIONS \\\\\

    function _updateFundingRate() internal {
        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 currentTime = block.timestamp;

        int256 marketTWAP = getMarketTwap();
        int256 indexTWAP = getOracleTwap();

        int256 currentTraderPremium = LibMath.wadDiv(marketTWAP - indexTWAP, indexTWAP);
        int256 timePassedSinceLastTrade = (currentTime - global.timeOfLastTrade).toInt256();
        int256 weightedTradePremiumOverLastPeriod = timePassedSinceLastTrade * currentTraderPremium;

        global.cumFundingRate +=
            (LibMath.wadMul(SENSITIVITY, weightedTradePremiumOverLastPeriod) * timePassedSinceLastTrade) /
            1 days;

        global.timeOfLastTrade = uint128(currentTime);
    }

    function getFundingPayments(address account) external view override returns (int256) {
        LibPerpetual.UserPosition memory user = traderPosition[account];
        LibPerpetual.GlobalPosition memory global = globalPosition;
        bool isLong = _getPositionDirection(user);

        return _getFundingPayments(isLong, user.cumFundingRate, global.cumFundingRate, LibMath.abs(user.positionSize));
    }

    /// @notice Calculate missed funding payments
    // slither-disable-next-line timestamp
    function _getFundingPayments(
        bool isLong,
        int256 userCumFundingRate,
        int256 globalCumFundingRate,
        int256 vBaseAmountToSettle
    ) internal pure returns (int256 upcomingFundingPayment) {
        /* Funding rates (as defined in our protocol) are paid from longs to shorts

            case 1: user is long  => has missed making funding payments (positive or negative)
            case 2: user is short => has missed receiving funding payments (positive or negative)

            comment: Making an negative funding payment is equivalent to receiving a positive one.
        */
        // slither-disable-next-line timestamp
        if (userCumFundingRate != globalCumFundingRate) {
            int256 upcomingFundingRate;
            if (isLong) {
                upcomingFundingRate = userCumFundingRate - globalCumFundingRate;
            } else {
                upcomingFundingRate = globalCumFundingRate - userCumFundingRate;
            }
            // fundingPayments = fundingRate * vBaseAmountToSettle
            upcomingFundingPayment = LibMath.wadMul(upcomingFundingRate, vBaseAmountToSettle);
        }
    }

    function updateTwapAndFundingRate() public override {
        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 currentTime = block.timestamp;
        uint256 timeOfLastTrade = uint256(global.timeOfLastTrade);

        // Don't update the state more than once per block
        // slither-disable-next-line timestamp
        if (currentTime > timeOfLastTrade) {
            _recordMarketPrice();
            _updateTwap();
            _updateFundingRate();
        }
    }

    function _recordMarketPrice() internal {
        globalPosition.blockStartPrice = marketPrice().toInt256();
    }

    function _updateTwap() internal {
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

    function _checkProposedAmount(
        bool isLong,
        int256 positionSize,
        uint256 proposedAmount
    ) internal view returns (bool) {
        if (isLong) {
            // proposedAmount is a vBase denominated amount
            // positionSize needs to be positive to allow LP positions looking like longs to be partially sold
            return proposedAmount <= LibMath.abs(positionSize).toUint256();
        } else {
            // Check that `proposedAmount` isn't too far from the value in the market
            // to avoid creating large swings in the market (even though these swings would be cancelled out
            // by the fact that we sell any extra vBase bought)

            // USD_amount = EUR_USD * EUR_amount
            int256 positivePositionSize = -positionSize;
            int256 reasonableVQuoteAmount = LibMath.wadMul(marketTwap, positivePositionSize);

            int256 deviation = LibMath.wadDiv(
                LibMath.abs(proposedAmount.toInt256() - reasonableVQuoteAmount),
                reasonableVQuoteAmount
            );

            // Allow for a 50% deviation from the market vQuote TWAP price to close this position
            // slither-disable-next-line timestamp (TODO: false positive)
            return deviation < 5e17;
        }
    }

    function _getPositionDirection(LibPerpetual.UserPosition memory user) internal view returns (bool isLong) {
        if (user.liquidityBalance > 0) {
            // LP position
            // determine if current position looks like a LONG or a SHORT by simulating a sell-off of the position
            int256 vBasePositionAfterVirtualWithdrawal = user.positionSize +
                (((market.balances(VBASE_INDEX) * user.liquidityBalance) / totalLiquidityProvided) - 1).toInt256();

            return vBasePositionAfterVirtualWithdrawal > 0;
        } else {
            // trader position
            return user.positionSize > 0;
        }
    }

    /// @dev Used both by traders closing their own positions and liquidators liquidating other people's positions
    /// @notice Profit is the sum of funding payments and the position PnL
    /// @param reductionRatio Percentage of the position that the user wishes to close. Min: 0. Max: 1e18
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    function _reducePosition(
        LibPerpetual.UserPosition storage user,
        LibPerpetual.GlobalPosition storage global,
        uint256 reductionRatio,
        uint256 proposedAmount,
        uint256 minAmount
    )
        internal
        returns (
            int256 vBaseAmount,
            int256 vQuoteProceeds,
            int256 profit
        )
    {
        bool isLong = _getPositionDirection(user);
        int256 positionSizeToReduce = LibMath.wadMul(user.positionSize, reductionRatio.toInt256());
        int256 openNotionalToReduce = LibMath.wadMul(user.openNotional, reductionRatio.toInt256());

        require(
            _checkProposedAmount(isLong, positionSizeToReduce, proposedAmount),
            "Amount submitted too far from the market price of the position"
        );

        // PnL of the position
        (vBaseAmount, vQuoteProceeds) = _reducePositionOnMarket(
            isLong,
            positionSizeToReduce,
            proposedAmount,
            minAmount
        );

        // update profit using funding payment info in the `global` struct
        int256 fundingPayment = _getFundingPayments(
            isLong,
            user.cumFundingRate,
            global.cumFundingRate,
            LibMath.abs(positionSizeToReduce)
        );

        profit = vQuoteProceeds + fundingPayment + openNotionalToReduce;
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
        return traderPosition[address(clearingHouse)].positionSize.toUint256();
    }

    /// @notice Returns vBaseAmount and vQuoteProceeds to reflect how much the position has been reduced
    function _reducePositionOnMarket(
        bool isLong,
        int256 positionSize,
        uint256 proposedAmount,
        uint256 minAmount
    ) internal returns (int256 vBaseAmount, int256 vQuoteProceeds) {
        if (isLong) {
            uint256 amount = _baseForQuote(proposedAmount, minAmount);
            vQuoteProceeds = amount.toInt256();
            vBaseAmount = -(proposedAmount.toInt256());
        } else {
            uint256 positivePositionSize = (-positionSize).toUint256();
            uint256 vBaseProceeds = _quoteForBase(proposedAmount, minAmount);

            uint256 additionalProceeds = 0;
            uint256 baseRemaining = 0;
            if (vBaseProceeds > positivePositionSize) {
                baseRemaining = vBaseProceeds - positivePositionSize;
                if (_canSellBase(baseRemaining)) {
                    // sell vBase tokens bought in excess
                    additionalProceeds = _baseForQuote(baseRemaining, 0);
                } else {
                    // dust vBase balance can not be sold
                    emit DustGenerated(baseRemaining);
                    _donate(baseRemaining);
                }
            }

            vQuoteProceeds = -proposedAmount.toInt256() + additionalProceeds.toInt256();
            // baseRemaining will be 0 if proposedAmount not more than what's needed to fully buy back short position
            vBaseAmount = (vBaseProceeds - baseRemaining).toInt256();
        }
    }

    function _donate(uint256 baseAmount) internal {
        traderPosition[address(clearingHouse)].positionSize += baseAmount.toInt256();
    }

    function _quoteForBase(uint256 quoteAmount, uint256 minAmount) internal returns (uint256) {
        // slither-disable-next-line unused-return
        vQuote.mint(quoteAmount);
        uint256 vBaseReceived = market.exchange(VQUOTE_INDEX, VBASE_INDEX, quoteAmount, minAmount);
        vBase.burn(vBaseReceived);
        return vBaseReceived;
    }

    function _baseForQuote(uint256 baseAmount, uint256 minAmount) internal returns (uint256) {
        // slither-disable-next-line unused-return
        vBase.mint(baseAmount);
        uint256 vQuoteReceived = market.exchange(VBASE_INDEX, VQUOTE_INDEX, baseAmount, minAmount);
        vQuote.burn(vQuoteReceived);
        return vQuoteReceived;
    }

    /// @notice Return amount for vBase one would receive for exchanging `vQuoteAmountToSpend` (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `extendPosition`
    function getExpectedVBaseAmount(uint256 vQuoteAmountToSpend) external view override returns (uint256) {
        return market.get_dy(VQUOTE_INDEX, VBASE_INDEX, vQuoteAmountToSpend);
    }

    /// @notice Return amount for vQuote one would receive for exchanging `vBaseAmountToSpend` (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `extendPosition`
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
