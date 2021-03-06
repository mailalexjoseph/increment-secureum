// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// interfaces
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVBase} from "./interfaces/IVBase.sol";
import {IVQuote} from "./interfaces/IVQuote.sol";
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";
import {IClearingHouse} from "./interfaces/IClearingHouse.sol";

// libraries
import {LibMath} from "./lib/LibMath.sol";
import {LibPerpetual} from "./lib/LibPerpetual.sol";

import "hardhat/console.sol";

/// @notice Handles all the trading logic. Interact with the CryptoSwap pool
contract Perpetual is IPerpetual {
    using LibMath for int256;
    using LibMath for uint256;

    // parameterization
    uint256 internal constant VQUOTE_INDEX = 0; // index of quote asset in curve pool
    uint256 internal constant VBASE_INDEX = 1; // index of base asset in curve pool
    uint256 internal constant TWAP_FREQUENCY = 15 minutes; // period over which twap is calculated
    int256 internal constant SENSITIVITY = 1e18; // funding rate sensitivity to price deviations
    int256 internal constant MAX_PRICE_DEVIATION = 5e16; // max price change per block

    // dependencies

    /// @notice vBase token (traded on CryptoSwap pool)
    IVBase public override vBase;

    /// @notice vQuote token (traded on CryptoSwap pool)
    IVQuote public override vQuote;

    /// @notice Clearing House contract
    IClearingHouse public override clearingHouse;

    /// @notice Curve CryptoSwap pool
    ICryptoSwap public override market;

    // global state
    LibPerpetual.GlobalPosition internal globalPosition;

    int256 internal oracleCumulativeAmount;
    int256 internal oracleCumulativeAmountAtBeginningOfPeriod;
    int256 internal oracleTwap;

    int256 internal marketCumulativeAmount;
    // slither-disable-next-line similar-names
    int256 internal marketCumulativeAmountAtBeginningOfPeriod;
    int256 internal marketTwap;

    // user state
    mapping(address => LibPerpetual.UserPosition) internal traderPosition;
    mapping(address => LibPerpetual.UserPosition) internal lpPosition;

    /* ****************** */
    /*     Events         */
    /* ****************** */

    /// @notice Emitted when twap is updated
    /// @param newOracleTwap Latest oracle Time-weighted-average-price
    /// @param newMarketTwap Latest market Time-weighted-average-price
    event TwapUpdated(int256 newOracleTwap, int256 newMarketTwap);

    /// @notice Emitted when funding rate is updated
    /// @param cumulativeFundingRate Cumulative sum of all funding rate updates
    /// @param fundingRate Latest fundingRate update
    event FundingRateUpdated(int256 cumulativeFundingRate, int256 fundingRate);

    /// @notice Emitted when swap with cryptoswap pool fails
    /// @param errorMessage Return error message
    event Log(string errorMessage);

    /// @notice Emitted when (base) dust is generated
    /// @param vBaseAmount Amount of dust
    event DustGenerated(uint256 vBaseAmount);

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
        require(vBase.approve(address(market), type(uint256).max), "NO APPROVAL");
        require(vQuote.approve(address(market), type(uint256).max), "NO APPROVAL");

        // initialize global state
        _initGlobalState(IVBase(_vBase).getIndexPrice(), ICryptoSwap(_market).last_prices().toInt256());
    }

    modifier onlyClearingHouse() {
        require(msg.sender == address(clearingHouse), "Only clearing house can call this function");
        _;
    }

    /* ****************** */
    /*   Trader flow      */
    /* ****************** */

    /// @notice Open or increase a position, either long or short
    /// @param account Address of the trader
    /// @param amount to be sold, in vQuote (if long) or vBase (if short)
    /// @param direction Long or Short
    /// @param minAmount Minimum amount received back, in vBase (if long) or vQuote (if short)
    /// @return openNotional Additional quote asset / liabilities accrued
    /// @return positionSize Additional base asset / liabilities accrued
    /// @return fundingPayments Settled funding payments
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
            int256 openNotional,
            int256 positionSize,
            int256 fundingPayments
        )
    {
        /*
            if direction = LONG

                trader goes long EUR
                trader accrues openNotional debt
                trader receives positionSize assets

                openNotional = vQuote traded to market    ( < 0)
                positionSize = vBase received from market ( > 0)

            else direction = SHORT

                trader goes short EUR
                trader receives openNotional assets
                trader accrues positionSize debt

                openNotional = vQuote received from market ( > 0)
                positionSize = vBase traded to market      ( < 0)

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
        (openNotional, positionSize) = _extendPosition(amount, isLong, minAmount);

        // check max deviation
        require(
            _checkPriceDeviation(marketPrice().toInt256(), globalPosition.blockStartPrice),
            "Price impact too large"
        );

        // update position
        fundingPayments = _settleFundingRate(trader, global);
        trader.openNotional += openNotional;
        trader.positionSize += positionSize;

        return (openNotional, positionSize, fundingPayments);
    }

    /// @notice Closes position from account holder
    /// @param account Trader account to close position for.
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    /// @return vQuoteProceeds Realized quote proceeds from closing the position
    /// @return vBaseAmount Position size reduction
    /// @return profit Profit realized
    function reducePosition(
        address account,
        uint256 proposedAmount,
        uint256 minAmount
    )
        external
        override
        onlyClearingHouse
        returns (
            int256 vQuoteProceeds,
            int256 vBaseAmount,
            int256 profit
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
                @proposedAmount := amount of vBase used to reduce the position (must be below user.positionSize)
                => User trades the vBase tokens with the curve pool for vQuote tokens

            trader has short position:
                @proposedAmount := amount of vQuote required to repay the vBase debt (must be below 1.5 x market value of user.positionSize)
                => User incurred vBase debt when opening a position and must now trade enough
                  vQuote with the curve pool to repay his vBase debt in full.
                => Remaining balances can be traded with the market for vQuote.

                @audit Note that this mechanism can be exploited by inserting a large value here, since traders
                will have to pay transaction fees anyways (on the curve pool). We set a limit of 1.5 x market value in _checkProposedAmount()
        */
        LibPerpetual.UserPosition storage trader = traderPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        require(trader.openNotional != 0 || trader.positionSize != 0, "No position currently opened in this market");

        // update state
        updateTwapAndFundingRate();

        int256 pnl;
        (vBaseAmount, vQuoteProceeds, pnl) = _reducePosition(trader, proposedAmount, minAmount);

        // check max deviation
        require(
            _checkPriceDeviation(marketPrice().toInt256(), globalPosition.blockStartPrice),
            "Price impact too large"
        );

        // adjust trader position
        profit = pnl + _settleFundingRate(trader, global); // pnl + fundingPayments
        trader.openNotional += vQuoteProceeds;
        trader.positionSize += vBaseAmount;

        // if position has been closed entirely, delete it from the state
        if (trader.positionSize == 0) {
            delete traderPosition[account];
        }

        return (vQuoteProceeds, vBaseAmount, profit);
    }

    /* ******************************/
    /*     Liquidity provider flow  */
    /* ******************************/

    /// @notice Provide liquidity to the pool
    /// @param account Liquidity provider
    /// @param wadAmount Amount of vQuote provided. 18 decimals
    /// @param minLpAmount Minimum amount of Lp tokens minted. 18 decimals
    /// @return baseAmount Amount of vBase provided. 18 decimals
    /// @return fundingPayments Settled funding payments
    function provideLiquidity(
        address account,
        uint256 wadAmount,
        uint256 minLpAmount
    ) external override onlyClearingHouse returns (uint256 baseAmount, int256 fundingPayments) {
        updateTwapAndFundingRate();

        // reflect the added liquidity on the LP position
        LibPerpetual.UserPosition storage lp = lpPosition[account];

        fundingPayments = 0;
        if (lp.cumFundingRate != globalPosition.cumFundingRate && lp.cumFundingRate != 0) {
            bool isLong = _getPositionDirection(lp);

            fundingPayments = _getFundingPayments(
                isLong,
                lp.cumFundingRate,
                globalPosition.cumFundingRate,
                lp.positionSize.abs()
            );
        }

        uint256 basePrice;
        if (getTotalLiquidityProvided() == 0) {
            basePrice = marketPrice();
        } else {
            basePrice = market.balances(0).wadDiv(market.balances(1));
        }
        baseAmount = wadAmount.wadDiv(basePrice); // vQuote / vBase/vQuote  <=> 1 / 1.2 = 0.83

        // supply liquidity to curve pool
        vQuote.mint(wadAmount);
        vBase.mint(baseAmount);

        uint256 liquidity = market.add_liquidity([wadAmount, baseAmount], minLpAmount); //  first token in curve pool is vQuote & second token is vBase

        lp.openNotional -= wadAmount.toInt256();
        lp.positionSize -= baseAmount.toInt256();
        lp.cumFundingRate = globalPosition.cumFundingRate;
        lp.liquidityBalance += liquidity;

        return (baseAmount, fundingPayments);
    }

    /// @notice Remove liquidity from the pool
    /// @param account Account of the LP to remove liquidity from
    /// @param liquidityAmountToRemove Amount of liquidity to be removed from the pool. 18 decimals
    /// @param minVTokenAmounts Minimum amount of virtual tokens [vQuote, vBase] withdrawn from the curve pool. 18 decimals
    /// @return quoteAmount Quote tokens withdrawn
    /// @return baseAmount Base tokens withdrawn
    /// @return fundingPayments Funding realized
    function removeLiquidity(
        address account,
        uint256 liquidityAmountToRemove,
        uint256[2] calldata minVTokenAmounts
    )
        external
        override
        onlyClearingHouse
        returns (
            uint256 quoteAmount,
            uint256 baseAmount,
            int256 fundingPayments
        )
    {
        LibPerpetual.UserPosition storage lp = lpPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        updateTwapAndFundingRate();

        // slither-disable-next-line incorrect-equality
        require(liquidityAmountToRemove <= lp.liquidityBalance, "Cannot remove more liquidity than LP provided");

        fundingPayments = _settleLpFundingRate(lp, global);

        // lower balances
        lp.liquidityBalance -= liquidityAmountToRemove;

        // remove liquidity from curve pool
        {
            // to avoid stack too deep errors
            uint256 vQuoteBalanceBefore = vQuote.balanceOf(address(this)); // can we just assume 0 here? NO!
            uint256 vBaseBalanceBefore = vBase.balanceOf(address(this));

            market.remove_liquidity(liquidityAmountToRemove, minVTokenAmounts);

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

        // if position has been closed entirely, delete it from the state
        // slither-disable-next-line incorrect-equality
        if (lp.positionSize == 0 && lp.liquidityBalance == 0 && lp.openNotional == 0) {
            delete lpPosition[account];
        }
    }

    /// @notice Settle liquidity provider
    /// @param account Account of the LP to settle
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    /// @return vQuoteProceeds Realized quote proceeds from closing the position
    /// @return vBaseAmount Position size reduction
    /// @return profit Profit realized
    function settleLiquidityProvider(
        address account,
        uint256 proposedAmount,
        uint256 minAmount
    )
        external
        override
        onlyClearingHouse
        returns (
            int256 vQuoteProceeds,
            int256 vBaseAmount,
            int256 profit
        )
    {
        LibPerpetual.UserPosition storage lp = lpPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        // update state
        updateTwapAndFundingRate();

        int256 pnl;
        (vBaseAmount, vQuoteProceeds, pnl) = _reducePosition(lp, proposedAmount, minAmount);

        // check max deviation
        require(
            _checkPriceDeviation(marketPrice().toInt256(), globalPosition.blockStartPrice),
            "Price impact too large"
        );

        // adjust trader position
        profit = pnl + _settleFundingRate(lp, global); // pnl + fundingPayments
        lp.openNotional += vQuoteProceeds;
        lp.positionSize += vBaseAmount;

        // if position has been closed entirely, delete it from the state
        if (lp.positionSize == 0) {
            delete lpPosition[account];
        }

        return (vQuoteProceeds, vBaseAmount, profit);
    }

    ///// COMMON OPERATIONS \\\\\

    /// @notice Update Twap, Funding Rate and last traded price
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

    /* ****************** */
    /*   Global getter    */
    /* ****************** */

    /// @notice Get global market position
    /// @return Global position
    function getGlobalPosition() external view override returns (LibPerpetual.GlobalPosition memory) {
        return globalPosition;
    }

    /// @notice Return the current off-chain exchange rate for vBase/vQuote
    /// @return Index price
    function indexPrice() public view override returns (int256) {
        return vBase.getIndexPrice();
    }

    /// @notice Return the last traded price (used for TWAP)
    /// @return lastPrice Last traded price
    function marketPrice() public view override returns (uint256 lastPrice) {
        return market.last_prices();
    }

    /// @notice Get the oracle Time-weighted-average-price
    /// @return oracle twap. 18 decimals
    function getOracleTwap() public view override returns (int256) {
        return oracleTwap;
    }

    /// @notice Get the market Time-weighted-average-price
    /// @return market twap. 18 decimals
    function getMarketTwap() public view override returns (int256) {
        return marketTwap;
    }

    /// @notice Get the market Total Liquidity provided to the Crypto Swap pool
    /// @return market twap. 18 decimals
    function getTotalLiquidityProvided() public view override returns (uint256) {
        return IERC20(market.token()).totalSupply();
    }

    /* ****************** */
    /*   User getter      */
    /* ****************** */

    /// @notice Get the missed funding payments for a trader
    /// @param account Trader
    /// @return upcomingFundingPayment Funding payment. 18 decimals
    function getFundingPayments(address account) external view override returns (int256 upcomingFundingPayment) {
        LibPerpetual.UserPosition memory user = traderPosition[account];
        LibPerpetual.GlobalPosition memory global = globalPosition;
        bool isLong = _getPositionDirection(user);

        return _getFundingPayments(isLong, user.cumFundingRate, global.cumFundingRate, user.positionSize.abs());
    }

    function getUnrealizedPnL(address account) external view override returns (int256) {
        LibPerpetual.UserPosition memory trader = traderPosition[account];
        int256 poolEURUSDTWAP = getMarketTwap();
        int256 vQuoteVirtualProceeds = trader.positionSize.wadMul(poolEURUSDTWAP);

        // in the case of a LONG, trader.openNotional is negative but vQuoteVirtualProceeds is positive
        // in the case of a SHORT, trader.openNotional is positive while vQuoteVirtualProceeds is negative
        return trader.openNotional + vQuoteVirtualProceeds;
    }

    /// @notice Get the position of a trader
    /// @param account Address to get the trading position from
    /// @return Trader position
    function getTraderPosition(address account) external view override returns (LibPerpetual.UserPosition memory) {
        return traderPosition[account];
    }

    /// @notice Get the position of a liquidity provider
    /// @param account Address to get the LP position from
    /// @return Liquidity Provider position
    function getLpPosition(address account) external view override returns (LibPerpetual.UserPosition memory) {
        return lpPosition[account];
    }

    /* ****************** */
    /*   Internal (Gov)   */
    /* ****************** */

    function _initGlobalState(int256 lastChainlinkPrice, int256 lastMarketPrice) internal {
        // initialize twap
        oracleTwap = lastChainlinkPrice;
        marketTwap = lastMarketPrice;

        // initialize funding
        globalPosition = LibPerpetual.GlobalPosition({
            timeOfLastTrade: uint128(block.timestamp),
            timeOfLastTwapUpdate: uint128(block.timestamp),
            cumFundingRate: 0,
            blockStartPrice: lastMarketPrice
        });
    }

    /* ****************** */
    /*  Internal (Market) */
    /* ****************** */

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

    /// @dev Used both by traders closing their own positions and liquidators liquidating other people's positions
    /// @notice Profit is the sum of funding payments and the position PnL
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    function _reducePosition(
        LibPerpetual.UserPosition memory user,
        uint256 proposedAmount,
        uint256 minAmount
    )
        internal
        returns (
            int256 vBaseAmount,
            int256 vQuoteProceeds,
            int256 pnl
        )
    {
        bool isLong = _getPositionDirection(user);

        require(
            _checkProposedAmount(isLong, user.positionSize, proposedAmount),
            "Amount submitted too far from the market price of the position or exceeds the position size"
        );

        // PnL of the position
        uint256 realizedReductionRatio;
        (vBaseAmount, vQuoteProceeds, realizedReductionRatio) = _reducePositionOnMarket(
            isLong,
            user.positionSize,
            proposedAmount,
            minAmount
        );

        // take the realized reduction ratio when calculating the pnl
        int256 openNotionalToReduce = user.openNotional.wadMul(realizedReductionRatio.toInt256());

        pnl = vQuoteProceeds + openNotionalToReduce;
    }

    /// @notice Returns vBaseAmount and vQuoteProceeds to reflect how much the position has been reduced
    function _reducePositionOnMarket(
        bool isLong,
        int256 positionSize,
        uint256 proposedAmount,
        uint256 minAmount
    )
        internal
        returns (
            int256 vBaseAmount,
            int256 vQuoteProceeds,
            uint256 realizedReductionRatio
        )
    {
        if (isLong) {
            uint256 amount = _baseForQuote(proposedAmount, minAmount);
            vQuoteProceeds = amount.toInt256();
            vBaseAmount = -(proposedAmount.toInt256());

            realizedReductionRatio = proposedAmount.wadDiv(positionSize.abs().toUint256()); //  abs() in case of partial removing liquidity
        } else {
            uint256 positivePositionSize = (-positionSize).toUint256();
            uint256 vBaseProceeds = _quoteForBase(proposedAmount, minAmount);

            /*
            Question: Why do we make up to two swap when closing a short position?
            Answer: We have to calculate the amount of quoteTokens needed
                    to close the position off-chain. (No exact-output-swap function).
                    Results can deviate from the expected amount.

            Example:
                pay back 100 base debt (positionSize = -100)

            1) calculate how much quote you have to sell to pay back 100 base debt (positionSize = -100)
                i.e. proposedAmount ~ 100 * EUR_USD ~ 110


            2) Swap 'proposedAmount' for 'baseTokensReceived' base tokens

                Case I) baseTokensReceived > positionSize

                    swap (baseTokensReceived - positionSize) for quoteTokens

                        swap successful?

                            Case I) yes, continue

                            Case 2) no, donate (baseTokenReceived - positionSize)

                Case II) baseTokensReceived < positionSize

                    fail

            */
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
            realizedReductionRatio = vBaseAmount.toUint256().wadDiv(positivePositionSize);
        }
    }

    function _quoteForBase(uint256 quoteAmount, uint256 minAmount) internal returns (uint256 vBaseReceived) {
        // slither-disable-next-line unused-return
        vQuote.mint(quoteAmount);
        vBaseReceived = market.exchange(VQUOTE_INDEX, VBASE_INDEX, quoteAmount, minAmount);
        vBase.burn(vBaseReceived);
    }

    function _baseForQuote(uint256 baseAmount, uint256 minAmount) internal returns (uint256 vQuoteReceived) {
        // slither-disable-next-line unused-return
        vBase.mint(baseAmount);
        vQuoteReceived = market.exchange(VBASE_INDEX, VQUOTE_INDEX, baseAmount, minAmount);
        vQuote.burn(vQuoteReceived);
    }

    // @notice Donate base tokens ("dust") to governance
    function _donate(uint256 baseAmount) internal {
        traderPosition[address(clearingHouse)].positionSize += baseAmount.toInt256();
    }

    function _settleFundingRate(LibPerpetual.UserPosition storage user, LibPerpetual.GlobalPosition storage global)
        internal
        returns (int256 fundingPayments)
    {
        // apply funding rate on existing positionSize
        fundingPayments = 0;
        if (user.positionSize != 0) {
            // settle trader funding rate
            fundingPayments = _getFundingPayments(
                user.positionSize > 0,
                user.cumFundingRate,
                global.cumFundingRate,
                user.positionSize.abs()
            );
        }

        user.cumFundingRate = global.cumFundingRate;

        return fundingPayments;
    }

    function _settleLpFundingRate(LibPerpetual.UserPosition storage lp, LibPerpetual.GlobalPosition storage global)
        internal
        returns (int256 fundingPayments)
    {
        // settle lp funding rate
        int256 virtualPositionSize = _getVBasePositionAfterVirtualWithdrawal(lp);
        fundingPayments = _getFundingPayments(
            virtualPositionSize > 0,
            lp.cumFundingRate,
            global.cumFundingRate,
            virtualPositionSize.abs()
        );
        lp.cumFundingRate = global.cumFundingRate;

        return fundingPayments;
    }

    /**************** TWAP ****************/
    function _updateFundingRate() internal {
        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 currentTime = block.timestamp;

        int256 marketTWAP = getMarketTwap();
        int256 indexTWAP = getOracleTwap();

        int256 currentTraderPremium = (marketTWAP - indexTWAP).wadDiv(indexTWAP);
        int256 timePassedSinceLastTrade = (currentTime - global.timeOfLastTrade).toInt256();

        int256 fundingRate = (SENSITIVITY.wadMul(currentTraderPremium) * timePassedSinceLastTrade) / 1 days;

        global.cumFundingRate += fundingRate;
        global.timeOfLastTrade = uint128(currentTime);

        emit FundingRateUpdated(global.cumFundingRate, fundingRate);
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

        // will overflow in ~3000 years
        // update cumulative chainlink price feed
        int256 latestChainlinkPrice = indexPrice();
        oracleCumulativeAmount += latestChainlinkPrice * timeElapsed;

        // update cumulative market price feed
        int256 latestMarketPrice = marketPrice().toInt256();
        marketCumulativeAmount += latestMarketPrice * timeElapsed;

        uint256 timeElapsedSinceBeginningOfPeriod = block.timestamp - globalPosition.timeOfLastTwapUpdate;

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
            globalPosition.timeOfLastTwapUpdate = uint128(block.timestamp);

            emit TwapUpdated(oracleTwap, marketTwap);
        }
    }

    /************************** */
    /* Internal Viewer (Market) */
    /************************** */

    function _checkProposedAmount(
        bool isLong,
        int256 positionSize,
        uint256 proposedAmount
    ) internal view returns (bool isValid) {
        /*
        Question: Why do we have to make use the proposedAmount parameters in our function?
        Answer: There is no equivalent to an swapForExact function in the CryptoSwap contract.
                https://docs.uniswap.org/protocol/guides/swaps/single-swaps#exact-output-swaps
                This means we in case of someone closing a short position (positionSize < 0)
                we can not calculate in our contract how many quoteTokens we have to swap with
                the curve Pool to pay pack the debt. Instead this is done outside of the contract.
                (see: TEST_get_exactOutputSwap() for an typescript implementation of a binary search
                to find the correct input amount).
                We only verify inside of the contract that our proposed amount is close enough
                to the initial estimate. All base tokens exceeding the positionSize are either swapped
                back for quoteTokens (dust is donated to the protocol)
                See: _reducePositionOnMarket for reference
        */

        if (isLong) {
            // proposedAmount is a vBase denominated amount
            // positionSize needs to be positive to allow LP positions looking like longs to be partially sold
            return proposedAmount <= positionSize.abs().toUint256();
        } else {
            // Check that `proposedAmount` isn't too far from the value in the market
            // to avoid creating large swings in the market (even though these swings would be cancelled out
            // by the fact that we sell any extra vBase bought)

            // USD_amount = EUR_USD * EUR_amount
            int256 positivePositionSize = -positionSize;
            int256 maxVQuoteAmount = (marketTwap + marketTwap / 2).wadMul(positivePositionSize); // 50% above the TWAP

            // Allow for a 50% deviation premium from the market vQuote TWAP price to close this position
            return proposedAmount.toInt256() <= maxVQuoteAmount;
        }
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
        if (userCumFundingRate != globalCumFundingRate) {
            int256 upcomingFundingRate = isLong
                ? userCumFundingRate - globalCumFundingRate
                : globalCumFundingRate - userCumFundingRate;

            // fundingPayments = fundingRate * vBaseAmountToSettle
            upcomingFundingPayment = upcomingFundingRate.wadMul(vBaseAmountToSettle);
        }
    }

    function _checkPriceDeviation(int256 currentPrice, int256 startBlockPrice) internal pure returns (bool) {
        // check if market price has changed more than by 5% in this block

        // price deviations of a given block does not exceed 5%
        // <=> 5% > (currentPrice - startBlockPrice) / currentPrice
        // 5 * currentPrice > (currentPrice - startBlockPrice) * 100

        // slither-disable-next-line incorrect-equality
        return (MAX_PRICE_DEVIATION * currentPrice > (currentPrice - startBlockPrice).abs() * 1e18);
    }

    function _getPositionDirection(LibPerpetual.UserPosition memory user) internal view returns (bool _isLong) {
        // slither-disable-next-line incorrect-equality
        if (user.liquidityBalance == 0) {
            // trader position
            return user.positionSize > 0;
        } else {
            return _getVBasePositionAfterVirtualWithdrawal(user) > 0;
        }
    }

    function _getVBasePositionAfterVirtualWithdrawal(LibPerpetual.UserPosition memory user)
        internal
        view
        returns (int256 vBasePositionAfterVirtualWithdrawal)
    {
        // LP position
        // determine if current position looks like a LONG or a SHORT by simulating a sell-off of the position
        vBasePositionAfterVirtualWithdrawal =
            user.positionSize +
            ((market.balances(VBASE_INDEX) * user.liquidityBalance) / getTotalLiquidityProvided()).toInt256() -
            1;
    }
}
