// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {IncreOwnable} from "./utils/IncreOwnable.sol";

// interfaces
import {IClearingHouse} from "./interfaces/IClearingHouse.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVault} from "./interfaces/IVault.sol";
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";
import {IInsurance} from "./interfaces/IInsurance.sol";

// libraries
import {LibMath} from "./lib/LibMath.sol";
import {LibPerpetual} from "./lib/LibPerpetual.sol";
import {LibReserve} from "./lib/LibReserve.sol";

import "hardhat/console.sol";

contract ClearingHouse is IClearingHouse, Context, IncreOwnable, Pausable {
    using SafeCast for uint256;
    using SafeCast for int256;
    using SafeERC20 for IERC20;

    // constants
    uint256 public constant FULL_REDUCTION_RATIO = 1e18; // reduce position by 100%

    // parameterization
    int256 public constant FEE = 3e16; // 3%
    int256 public constant MIN_MARGIN = 25e15; // 2.5%
    int256 public constant MIN_MARGIN_AT_CREATION = MIN_MARGIN + FEE + 25e15; // initial margin is 2.5% + 3% + 2.5% = 8%
    uint256 public constant LIQUIDATION_REWARD = 60e15; // 6%
    int256 public constant INSURANCE_FEE = 1e15; // 0.1%
    uint256 internal constant INSURANCE_RATIO = 1e17; // 10%

    // dependencies
    IVault public override vault;
    IInsurance public override insurance;
    IPerpetual[] public override perpetuals;

    constructor(IVault _vault, IInsurance _insurance) {
        require(address(_vault) != address(0), "Vault address cannot be 0");
        require(address(_insurance) != address(0), "Insurance address cannot be 0");
        vault = _vault;
        insurance = _insurance;
    }

    /* ****************** */
    /*     Governance     */
    /* ****************** */

    /// @notice Add one perpetual market to the list of markets
    /// @param perp Market to add to the list of supported market
    function allowListPerpetual(IPerpetual perp) external override onlyOwner {
        perpetuals.push(perp);
        emit MarketAdded(perp, perpetuals.length);
    }

    function pause() external override onlyOwner {
        _pause();
    }

    function unpause() external override onlyOwner {
        _unpause();
    }

    function sellDust(
        uint256 idx,
        uint256 proposedAmount,
        uint256 minAmount
    ) external override onlyOwner {
        (, , int256 profit) = perpetuals[idx].reducePosition(
            address(this),
            FULL_REDUCTION_RATIO,
            proposedAmount,
            minAmount
        );

        // apply changes to collateral
        vault.settleProfit(idx, address(this), profit, true);
    }

    function removeInsurance(
        uint256 idx,
        uint256 amount,
        IERC20 token
    ) external override onlyOwner {
        require(vault.withdraw(idx, address(this), amount, token, true) > 0);

        IERC20(token).safeTransfer(msg.sender, IERC20(token).balanceOf(address(this)));

        uint256 lockedInsurance = vault.getTraderBalance(0, address(this)).toUint256();
        uint256 tvl = vault.getTotalReserveToken();

        require(lockedInsurance >= tvl * INSURANCE_RATIO, "Insurance is not enough");
    }

    ///// TRADER FLOW OPERATIONS \\\\\

    /// @notice Single open position function, group collateral deposit and extend position
    /// @param idx Index of the perpetual market
    /// @param collateralAmount Amount to be used as the collateral of the position. Might not be 18 decimals
    /// @param token Token to be used for the collateral of the position
    /// @param positionAmount Amount to be sold, in vQuote (if long) or vBase (if short). Must be 18 decimals
    /// @param direction Whether the position is LONG or SHORT
    /// @param minAmount Minimum amount that the user is willing to accept. 18 decimals
    function extendPositionWithCollateral(
        uint256 idx,
        uint256 collateralAmount,
        IERC20 token,
        uint256 positionAmount,
        LibPerpetual.Side direction,
        uint256 minAmount
    ) external override returns (int256, int256) {
        deposit(idx, collateralAmount, token, true);
        return extendPosition(idx, positionAmount, direction, minAmount);
    }

    /// @notice Deposit tokens into the vault
    /// @param idx Index of the perpetual market
    /// @param amount Amount to be used as collateral. Might not be 18 decimals
    /// @param token Token to be used for the collateral
    function deposit(
        uint256 idx,
        uint256 amount,
        IERC20 token,
        bool isTrader
    ) public override whenNotPaused {
        require(vault.deposit(idx, msg.sender, amount, token, isTrader) > 0);
        emit Deposit(idx, msg.sender, address(token), amount);
    }

    /// @notice Withdraw tokens from the vault
    /// @param idx Index of the perpetual market
    /// @param amount Amount of collateral to withdraw. Might not be 18 decimals
    /// @param token Token of the collateral
    function withdraw(
        uint256 idx,
        uint256 amount,
        IERC20 token,
        bool isTrader
    ) external override whenNotPaused {
        // slither-disable-next-line incorrect-equality
        // slither-disable-next-line timestamp // TODO: sounds incorrect
        require(getTraderPosition(idx, msg.sender).openNotional == 0, "Has open position"); // TODO: can we loosen this restriction (i.e. check marginRatio in the end?)

        require(vault.withdraw(idx, msg.sender, amount, token, isTrader) > 0);
        emit Withdraw(idx, msg.sender, address(token), amount);
    }

    /// @notice Open or increase a position, either long or short
    /// @param idx Index of the perpetual market
    /// @param amount Represent amount in vQuote (if long) or vBase (if short) to sell. 18 decimals
    /// @param direction Whether the position is LONG or SHORT
    /// @param minAmount Minimum amount that the user is willing to accept. 18 decimals
    /// @dev No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGIN_AT_CREATION
    /// @dev No checks are done if bought amount exceeds allowance
    function extendPosition(
        uint256 idx,
        uint256 amount,
        LibPerpetual.Side direction,
        uint256 minAmount
    ) public override whenNotPaused returns (int256, int256) {
        /*
            if direction = Long

                trader goes long EUR
                trader accrues openNotional debt
                trader receives positionSize assets

                openNotional = vQuote traded   to market   ( < 0)
                positionSize = vBase  received from market ( > 0)

            else direction = Short

                trader goes short EUR
                trader receives openNotional assets
                trader accrues positionSize debt

                openNotional = vQuote received from market ( > 0)
                positionSize = vBase  traded   to market   ( < 0)

        */
        require(amount > 0, "The amount can't be null");

        (int256 addedOpenNotional, int256 addedPositionSize, int256 fundingPayments) = perpetuals[idx].extendPosition(
            msg.sender,
            amount,
            direction,
            minAmount
        );

        // pay insurance fee: TODO: can never withdraw this amount!
        int256 insuranceFee = LibMath.wadMul(LibMath.abs(addedOpenNotional), INSURANCE_FEE);
        vault.settleProfit(0, address(this), insuranceFee, true); // always deposit insurance fees into the 0 vault

        int256 traderVaultDiff = fundingPayments - insuranceFee;
        vault.settleProfit(idx, msg.sender, traderVaultDiff, true);

        require(marginIsValid(idx, msg.sender, MIN_MARGIN_AT_CREATION), "Not enough margin");

        emit ExtendPosition(idx, msg.sender, uint128(block.timestamp), direction, addedOpenNotional, addedPositionSize);

        return (addedOpenNotional, addedPositionSize);
    }

    /// @notice Reduces, or closes in full, a position from an account holder
    /// @param idx Index of the perpetual market
    /// @param reductionRatio Percentage of the position that the user wishes to close. Min: 0. Max: 1e18
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    function reducePosition(
        uint256 idx,
        uint256 reductionRatio,
        uint256 proposedAmount,
        uint256 minAmount
    ) external override whenNotPaused {
        require(proposedAmount > 0, "The proposed amount can't be null");

        (int256 reducedOpenNotional, int256 reducedPositionSize, int256 profit) = perpetuals[idx].reducePosition(
            msg.sender,
            reductionRatio,
            proposedAmount,
            minAmount
        );

        // apply changes to collateral
        vault.settleProfit(idx, msg.sender, profit, true);

        emit ReducePosition(idx, msg.sender, uint128(block.timestamp), reducedOpenNotional, reducedPositionSize);
    }

    /// @notice Determines whether or not a position is valid for a given margin ratio
    /// @param idx Index of the perpetual market
    /// @param account Account of the position to get the margin ratio from
    /// @param ratio Proposed ratio to compare the position against
    function marginIsValid(
        uint256 idx,
        address account,
        int256 ratio
    ) public view override returns (bool) {
        // slither-disable-next-line timestamp
        return marginRatio(idx, account) >= ratio;
    }

    /// @notice Get the margin ratio of a trading position (given that, for now, 1 trading position = 1 address)
    /// @param idx Index of the perpetual market
    /// @param account Account of the position to get the margin ratio from
    function marginRatio(uint256 idx, address account) public view override returns (int256) {
        // margin ratio = (collateral + unrealizedPositionPnl + fundingPayments) / trader.openNotional
        // all amounts must be expressed in vQuote (e.g. USD), otherwise the end result doesn't make sense
        int256 openNotional = getTraderPosition(idx, account).openNotional;
        require(openNotional != 0, "No open position");

        int256 collateral = getReserveValue(idx, account);
        int256 fundingPayments = getFundingPayments(idx, account);
        int256 unrealizedPositionPnl = getUnrealizedPnL(idx, account);

        int256 positiveOpenNotional = LibMath.abs(openNotional);

        return LibMath.wadDiv(collateral + unrealizedPositionPnl + fundingPayments, positiveOpenNotional);
    }

    /// @notice Submit the address of a trader whose position is worth liquidating for a reward
    /// @param idx Index of the perpetual market
    /// @param liquidatee Address of the trader to liquidate
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    function liquidate(
        uint256 idx,
        address liquidatee,
        uint256 proposedAmount
    ) external override whenNotPaused {
        address liquidator = msg.sender;

        uint256 positiveOpenNotional = uint256(LibMath.abs(perpetuals[idx].getTraderPosition(liquidatee).openNotional));

        require(getTraderPosition(idx, liquidatee).openNotional != 0, "No position currently opened");
        require(!marginIsValid(idx, liquidatee, MIN_MARGIN), "Margin is valid");

        (, , int256 profit) = perpetuals[idx].reducePosition(liquidatee, FULL_REDUCTION_RATIO, proposedAmount, 0);

        // traders are allowed to reduce their positions partially, but liquidators have to close positions in full
        require(
            getTraderPosition(idx, liquidatee).openNotional == 0,
            "Proposed amount insufficient to liquidate the position in its entirety"
        );

        // adjust liquidator vault amount
        uint256 liquidationRewardAmount = LibMath.wadMul(positiveOpenNotional, LIQUIDATION_REWARD);

        // subtract reward from liquidatee
        int256 reducedProfit = profit - liquidationRewardAmount.toInt256();
        vault.settleProfit(idx, liquidatee, reducedProfit, true);

        // add reward to liquidator
        vault.settleProfit(idx, liquidator, liquidationRewardAmount.toInt256(), true);

        emit LiquidationCall(idx, liquidatee, liquidator, uint128(block.timestamp), positiveOpenNotional);
    }

    ///// LIQUIDITY PROVISIONING FLOW OPERATIONS \\\\\

    /// @notice Provide liquidity to the pool
    /// @param idx Index of the perpetual market
    /// @param amount Amount of token to be added to the pool. Might not have 18 decimals
    /// @param token Token to be added to the pool
    function provideLiquidity(
        uint256 idx,
        uint256 amount,
        IERC20 token
    ) external override whenNotPaused returns (uint256, uint256) {
        // slither-disable-next-line timestamp // TODO: sounds incorrect
        require(amount != 0, "Zero amount");

        // split liquidity between long and short (TODO: account for value of liquidity provider already made)
        uint256 wadAmount = vault.deposit(idx, msg.sender, amount, token, false);

        (uint256 baseAmount, int256 fundingPayments) = perpetuals[idx].provideLiquidity(msg.sender, wadAmount);

        if (fundingPayments != 0) {
            vault.settleProfit(idx, msg.sender, fundingPayments, false);
        }

        emit LiquidityProvided(idx, msg.sender, address(token), amount);
        return (wadAmount, baseAmount);
    }

    /// @notice Remove liquidity from the pool
    /// @param idx Index of the perpetual market
    /// @param liquidityAmountToRemove Amount of liquidity (in LP tokens) to be removed from the pool. 18 decimals
    /// @param reductionRatio Percentage of the position that the user wishes to close. Min: 0. Max: 1e18
    /// @param proposedAmount Amount at which to get the LP position (in vBase if LONG, in vQuote if SHORT). 18 decimals
    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    /// @param token Token in which to perform the funds withdrawal
    function removeLiquidity(
        uint256 idx,
        uint256 liquidityAmountToRemove,
        uint256 reductionRatio,
        uint256 proposedAmount,
        uint256 minAmount,
        IERC20 token
    ) external override whenNotPaused {
        (int256 vQuoteProceeds, int256 vBaseAmount, int256 profit) = perpetuals[idx].removeLiquidity(
            msg.sender,
            liquidityAmountToRemove,
            reductionRatio,
            proposedAmount,
            minAmount
        );

        vault.settleProfit(idx, msg.sender, profit, false);

        // remove the liquidity provider from the list
        // slither-disable-next-line unused-return // can be zero amount
        vault.withdrawAll(idx, msg.sender, token, false);

        emit LiquidityRemoved(
            idx,
            msg.sender,
            liquidityAmountToRemove,
            vQuoteProceeds,
            vBaseAmount,
            profit,
            address(token)
        );
    }

    /// @notice Return amount for vBase one would receive for exchanging `vQuoteAmountToSpend` in a select market (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `extendPosition`
    /// @param idx Index of the perpetual market
    /// @param vQuoteAmountToSpend Amount of vQuote to be exchanged against some vBase. 18 decimals
    function getExpectedVBaseAmount(uint256 idx, uint256 vQuoteAmountToSpend) external view override returns (uint256) {
        return perpetuals[idx].getExpectedVBaseAmount(vQuoteAmountToSpend);
    }

    /// @notice Return amount for vQuote one would receive for exchanging `vBaseAmountToSpend` in a select market (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `extendPosition`
    /// @param idx Index of the perpetual market
    /// @param vBaseAmountToSpend Amount of vBase to be exchanged against some vQuote. 18 decimals
    function getExpectedVQuoteAmount(uint256 idx, uint256 vBaseAmountToSpend) external view override returns (uint256) {
        return perpetuals[idx].getExpectedVQuoteAmount(vBaseAmountToSpend);
    }

    /// @notice Calculate missed funding payments
    // slither-disable-next-line timestamp
    /// @param idx Index of the perpetual market
    /// @param account Trader to get the funding payments
    function getFundingPayments(uint256 idx, address account)
        public
        view
        override
        returns (int256 upcomingFundingPayment)
    {
        return perpetuals[idx].getFundingPayments(account);
    }

    /// @param idx Index of the perpetual market
    /// @param account Trader to get the unrealized PnL from
    function getUnrealizedPnL(uint256 idx, address account) public view override returns (int256) {
        return perpetuals[idx].getUnrealizedPnL(account);
    }

    /// @notice Get the portfolio value of an account
    /// @param idx Index of the perpetual market
    /// @param account Address to get the portfolio value from
    function getReserveValue(uint256 idx, address account) public view override returns (int256) {
        return vault.getTraderReserveValue(idx, account);
    }

    /// @notice Return the curve price oracle
    /// @param idx Index of the perpetual market
    function marketPriceOracle(uint256 idx) external view override returns (uint256) {
        return perpetuals[idx].marketPriceOracle();
    }

    /// @notice Return the last traded price (used for TWAP)
    /// @param idx Index of the perpetual market
    function marketPrice(uint256 idx) external view override returns (uint256) {
        return perpetuals[idx].marketPrice();
    }

    /// @notice Return the current off-chain exchange rate for vBase/vQuote
    /// @param idx Index of the perpetual market
    function indexPrice(uint256 idx) external view override returns (int256) {
        return perpetuals[idx].indexPrice();
    }

    /// @param idx Index of the perpetual market
    function getGlobalPosition(uint256 idx) external view override returns (LibPerpetual.GlobalPosition memory) {
        return perpetuals[idx].getGlobalPosition();
    }

    /// @param idx Index of the perpetual market
    /// @param account Address to get the trading position from
    function getTraderPosition(uint256 idx, address account)
        public
        view
        override
        returns (LibPerpetual.UserPosition memory)
    {
        return perpetuals[idx].getTraderPosition(account);
    }

    /// @param idx Index of the perpetual market
    /// @param account Address to get the LP position from
    function getLpPosition(uint256 idx, address account)
        external
        view
        override
        returns (LibPerpetual.UserPosition memory)
    {
        return perpetuals[idx].getLpPosition(account);
    }

    function getNumMarkets() external view override returns (uint256) {
        return perpetuals.length;
    }
}
