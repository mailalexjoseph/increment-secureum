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

/// @notice Entry point for users to vault and perpetual markets
contract ClearingHouse is IClearingHouse, Context, IncreOwnable, Pausable {
    using LibMath for int256;
    using LibMath for uint256;
    using SafeERC20 for IERC20;

    // constants
    uint256 internal constant FULL_REDUCTION_RATIO = 1e18; // reduce position by 100%

    // parameterization

    /// @notice minimum maintenance margin
    /// @dev 2.5%
    int256 public constant MIN_MARGIN = 25e15;

    /// @notice minimum margin when opening a position
    /// @dev 2.5% (maintenance margin) + 5.5% = 8%
    int256 public constant MIN_MARGIN_AT_CREATION = MIN_MARGIN + 55e15;

    /// @notice minimum maintenance margin
    /// @dev Paid on dollar value of an trader position. important: LIQUIDATION_REWARD >> MIN_MARGIN or liquidations will result in protocol losses
    /// @dev (1.5%)
    uint256 public constant LIQUIDATION_REWARD = 15e15;

    /// @notice Insurance fee
    /// @dev Paid on dollar value of an opened position
    /// @dev (0.1%)
    int256 public constant INSURANCE_FEE = 1e15;

    /// @notice Insurance ratio
    /// @dev Once the insurance reserve exceed 10% of the tvl, governance can withdraw the insurance fee
    /// @dev (10%)
    uint256 public constant INSURANCE_RATIO = 1e17;

    // dependencies

    /// @notice Vault contract
    IVault public override vault;

    /// @notice Insurance contract
    IInsurance public override insurance;

    /// @notice Allowlisted Perpetual contracts
    IPerpetual[] public override perpetuals;

    /* ****************** */
    /*     Events         */
    /* ****************** */

    /// @notice Emitted when new perpetual market is added
    /// @param perpetual The new perpetual market
    /// @param numPerpetuals The number of perpetual markets
    event MarketAdded(IPerpetual indexed perpetual, uint256 numPerpetuals);

    /// @notice Emitted when collateral is deposited into the vault
    /// @param idx Index of the perpetual market
    /// @param user User who deposited collateral
    /// @param asset Token to be used for the collateral
    /// @param amount Amount to be used as collateral. Might not be 18 decimals
    event Deposit(uint256 indexed idx, address indexed user, address indexed asset, uint256 amount);

    /// @notice Emitted when collateral is withdrawn from the vault
    /// @param idx Index of the perpetual market
    /// @param user User who deposited collateral
    /// @param asset Amount to be used as collateral. Might not be 18 decimals
    /// @param amount Token to be used for the collateral
    event Withdraw(uint256 indexed idx, address indexed user, address indexed asset, uint256 amount);

    /// @notice Emitted when a position is extended/opened
    /// @param idx Index of the perpetual market
    /// @param user User who deposited collateral
    /// @param direction Whether the position is LONG or SHORT
    /// @param addedOpenNotional Notional (USD assets/debt) added to the position
    /// @param addedPositionSize positionSize (Base assets/debt) added to the position
    event ExtendPosition(
        uint256 indexed idx,
        address indexed user,
        LibPerpetual.Side direction,
        int256 addedOpenNotional,
        int256 addedPositionSize
    );
    /// @notice Emitted when a position is reduced/closed
    /// @param idx Index of the perpetual market
    /// @param user User who deposited collateral
    /// @param reducedOpenNotional notional (USD assets/debt) removed from the position
    /// @param reducedPositionSize positionSize (Base assets/debt) removed from the position
    event ReducePosition(
        uint256 indexed idx,
        address indexed user,
        int256 reducedOpenNotional,
        int256 reducedPositionSize
    );
    /// @notice Emitted when a trader position is liquidated
    /// @param idx Index of the perpetual market
    /// @param liquidatee User who gets liquidated
    /// @param liquidator User who is liquidating
    /// @param notional Notional amount of the liquidatee
    event LiquidationCall(
        uint256 indexed idx,
        address indexed liquidatee,
        address indexed liquidator,
        uint256 notional
    );
    /// @notice Emitted when a (additional) liquidity is provided
    /// @param idx Index of the perpetual market
    /// @param liquidityProvider User who provides liquidity
    /// @param asset  Token to be added to the pool
    /// @param amount Amount of token to be added to the pool. Might not have 18 decimals
    event LiquidityProvided(
        uint256 indexed idx,
        address indexed liquidityProvider,
        address indexed asset,
        uint256 amount
    );
    /// @notice Emitted when a (additional) liquidity is removed
    /// @param idx Index of the perpetual market
    /// @param liquidityProvider User who provides liquidity
    /// @param removedLiquidity Amount of liquidity (in LP tokens) to be removed from the pool. 18 decimals
    /// @param vQuoteProceeds Amount of vQuote proceeds to be removed from the pool. 18 decimals
    /// @param vBaseAmount Amount of vBase proceeds to be removed from the pool. 18 decimals
    /// @param profit Profit generated by the liquidity provider. 18 decimals
    /// @param asset  Token to be added to the pool
    event LiquidityRemoved(
        uint256 indexed idx,
        address indexed liquidityProvider,
        uint256 removedLiquidity,
        int256 vQuoteProceeds,
        int256 vBaseAmount,
        int256 profit,
        address indexed asset
    );

    /// @notice Emitted when dust is sold by governance
    /// @param idx Index of the perpetual market
    /// @param profit Amount of profit generated by the dust sale. 18 decimals
    event DustSold(uint256 indexed idx, int256 profit);

    /// @notice Emitted when (exceeding) insurance reserves are withdrawn by governance
    /// @param amount Amount of insurance reserves withdrawn. 18 decimals
    event InsuranceRemoved(uint256 amount);

    constructor(IVault _vault, IInsurance _insurance) {
        require(address(_vault) != address(0), "Vault address cannot be 0");
        require(address(_insurance) != address(0), "Insurance address cannot be 0");
        vault = _vault;
        insurance = _insurance;
    }

    /* ****************** */
    /*   Trader flow      */
    /* ****************** */

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
    ) external override whenNotPaused returns (int256, int256) {
        deposit(idx, collateralAmount, token);
        return extendPosition(idx, positionAmount, direction, minAmount);
    }

    /// @notice Deposit tokens into the vault
    /// @dev Should only be called by the trader
    /// @param idx Index of the perpetual market
    /// @param amount Amount to be used as collateral. Might not be 18 decimals
    /// @param token Token to be used for the collateral
    function deposit(
        uint256 idx,
        uint256 amount,
        IERC20 token
    ) public override whenNotPaused {
        require(vault.deposit(idx, msg.sender, amount, token, true) > 0);
        emit Deposit(idx, msg.sender, address(token), amount);
    }

    /// @notice Withdraw tokens from the vault
    /// @dev Should only be called by the trader
    /// @param idx Index of the perpetual market
    /// @param amount Amount of collateral to withdraw. Must be 18 decimals
    /// @param token Token of the collateral
    function withdraw(
        uint256 idx,
        uint256 amount,
        IERC20 token
    ) external override whenNotPaused {
        // unlike `amount` which is 18 decimal-based, `withdrawAmount` is based on the number of decimals of `token`
        uint256 withdrawAmount = vault.withdraw(idx, msg.sender, amount, token, true);

        require(marginIsValid(idx, msg.sender, MIN_MARGIN_AT_CREATION), "Not enough margin");

        emit Withdraw(idx, msg.sender, address(token), withdrawAmount);
    }

    /// @notice Open or increase a position, either long or short
    /// @param idx Index of the perpetual market
    /// @param amount Represent amount in vQuote (if long) or vBase (if short) to sell. 18 decimals
    /// @param direction Whether the position is LONG or SHORT
    /// @param minAmount Minimum amount that the user is willing to accept. 18 decimals
    /// @dev No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGIN_AT_CREATION
    /// @dev No checks are done if bought amount exceeds allowance
    /// @return addedOpenNotional Additional quote asset / liabilities accrued
    /// @return addedPositionSize Additional base asset / liabilities accrued
    function extendPosition(
        uint256 idx,
        uint256 amount,
        LibPerpetual.Side direction,
        uint256 minAmount
    ) public override whenNotPaused returns (int256 addedOpenNotional, int256 addedPositionSize) {
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

        int256 fundingPayments = 0;
        (addedOpenNotional, addedPositionSize, fundingPayments) = perpetuals[idx].extendPosition(
            msg.sender,
            amount,
            direction,
            minAmount
        );

        // pay insurance fee
        int256 insuranceFee = addedOpenNotional.abs().wadMul(INSURANCE_FEE);
        vault.settleProfit(0, address(this), insuranceFee, true); // always deposit insurance fees into the 0 vault

        int256 traderVaultDiff = fundingPayments - insuranceFee;
        vault.settleProfit(idx, msg.sender, traderVaultDiff, true);

        require(marginIsValid(idx, msg.sender, MIN_MARGIN_AT_CREATION), "Not enough margin");

        emit ExtendPosition(idx, msg.sender, direction, addedOpenNotional, addedPositionSize);

        return (addedOpenNotional, addedPositionSize);
    }

    /// @notice Single close position function, groups close position and withdraw collateral
    /// @notice Important: `proposedAmount` must be large enough to close the entire position else the function call will fail
    /// @param idx Index of the perpetual market
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    /// @param token Token used for the collateral
    function closePositionWithdrawCollateral(
        uint256 idx,
        uint256 proposedAmount,
        uint256 minAmount,
        IERC20 token
    ) external override whenNotPaused {
        reducePosition(idx, FULL_REDUCTION_RATIO, proposedAmount, minAmount);

        uint256 withdrawAmount = vault.withdrawAll(idx, msg.sender, token, true);
        emit Withdraw(idx, msg.sender, address(token), withdrawAmount);
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
    ) public override whenNotPaused {
        require(proposedAmount > 0, "The proposed amount can't be null");

        (int256 reducedOpenNotional, int256 reducedPositionSize, int256 profit) = perpetuals[idx].reducePosition(
            msg.sender,
            reductionRatio,
            proposedAmount,
            minAmount
        );

        // apply changes to collateral
        vault.settleProfit(idx, msg.sender, profit, true);

        emit ReducePosition(idx, msg.sender, reducedOpenNotional, reducedPositionSize);
    }

    /* ****************** */
    /*  Liquidation flow  */
    /* ****************** */

    /// @notice Determines whether or not a position is valid for a given margin ratio
    /// @param idx Index of the perpetual market
    /// @param account Account of the position to get the margin ratio from
    /// @param ratio Proposed ratio to compare the position against
    /// @return True if the position exceeds margin ratio, false otherwise
    function marginIsValid(
        uint256 idx,
        address account,
        int256 ratio
    ) public view override returns (bool) {
        return marginRatio(idx, account) >= ratio;
    }

    /// @notice Get the margin ratio of a trading position (given that, for now, 1 trading position = 1 address)
    /// @param idx Index of the perpetual market
    /// @param account Account of the position to get the margin ratio from
    /// @return Margin ratio of the position (in 1e18)
    function marginRatio(uint256 idx, address account) public view override returns (int256) {
        // margin ratio = (collateral + unrealizedPositionPnl + fundingPayments) / trader.openNotional
        // all amounts must be expressed in vQuote (e.g. USD), otherwise the end result doesn't make sense
        int256 openNotional = _getTraderPosition(idx, account).openNotional;

        // when no position open, margin ratio is 100%
        if (openNotional == 0) {
            return 1e18;
        }

        int256 collateral = _getTraderReserveValue(idx, account);
        int256 fundingPayments = _getFundingPayments(idx, account);
        int256 unrealizedPositionPnl = _getUnrealizedPnL(idx, account);

        return _marginRatio(collateral, unrealizedPositionPnl, fundingPayments, openNotional);
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

        // update funding rate, so that the marginRatio is correct
        perpetuals[idx].updateTwapAndFundingRate();

        uint256 positiveOpenNotional = uint256(_getTraderPosition(idx, liquidatee).openNotional.abs());

        require(positiveOpenNotional != 0, "No position currently opened");
        require(!marginIsValid(idx, liquidatee, MIN_MARGIN), "Margin is valid");

        (, , int256 profit) = perpetuals[idx].reducePosition(liquidatee, FULL_REDUCTION_RATIO, proposedAmount, 0);

        // traders are allowed to reduce their positions partially, but liquidators have to close positions in full
        require(
            _getTraderPosition(idx, liquidatee).openNotional == 0,
            "Proposed amount insufficient to liquidate the position in its entirety"
        );

        // adjust liquidator vault amount
        uint256 liquidationRewardAmount = positiveOpenNotional.wadMul(LIQUIDATION_REWARD);

        // subtract reward from liquidatee
        int256 reducedProfit = profit - liquidationRewardAmount.toInt256();
        vault.settleProfit(idx, liquidatee, reducedProfit, true);

        // add reward to liquidator
        vault.settleProfit(idx, liquidator, liquidationRewardAmount.toInt256(), true);

        emit LiquidationCall(idx, liquidatee, liquidator, positiveOpenNotional);
    }

    /* ****************** */
    /*   Liquidity flow   */
    /* ****************** */

    /// @notice Provide liquidity to the pool
    /// @param idx Index of the perpetual market
    /// @param amount Amount of token to be added to the pool. Might not have 18 decimals
    /// @param minLpAmount Minimum amount of Lp tokens minted with 1e18 precision
    /// @param token Token to be added to the pool
    /// @return wadAmount Amount of quoteTokens added to the pool
    /// @return baseAmount Amount of baseTokens added to the pool
    function provideLiquidity(
        uint256 idx,
        uint256 amount,
        uint256 minLpAmount,
        IERC20 token
    ) external override whenNotPaused returns (uint256 wadAmount, uint256 baseAmount) {
        require(amount != 0, "Zero amount");

        // split liquidity between long and short

        wadAmount = vault.deposit(idx, msg.sender, amount, token, false);

        int256 fundingPayments = 0;
        (baseAmount, fundingPayments) = perpetuals[idx].provideLiquidity(msg.sender, wadAmount, minLpAmount);

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
    /// @param minVTokenAmounts Minimum amount of virtual tokens [vQuote, vBase] withdrawn from the curve pool. 18 decimals

    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    /// @param token Token in which to perform the funds withdrawal
    function removeLiquidity(
        uint256 idx,
        uint256 liquidityAmountToRemove,
        uint256 reductionRatio,
        uint256 proposedAmount,
        uint256[2] calldata minVTokenAmounts,
        uint256 minAmount,
        IERC20 token
    ) external override whenNotPaused {
        (int256 vQuoteProceeds, int256 vBaseAmount, int256 profit) = perpetuals[idx].removeLiquidity(
            msg.sender,
            liquidityAmountToRemove,
            reductionRatio,
            proposedAmount,
            minVTokenAmounts,
            minAmount
        );

        vault.settleProfit(idx, msg.sender, profit, false);

        // remove the part of the reserve
        require(vault.withdrawPartial(idx, msg.sender, token, reductionRatio, false) > 0, "Insufficient funds");

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

    /* ****************** */
    /*     Governance     */
    /* ****************** */

    /// @notice Add one perpetual market to the list of markets
    /// @param perp Market to add to the list of supported market
    function allowListPerpetual(IPerpetual perp) external override onlyOwner {
        perpetuals.push(perp);
        emit MarketAdded(perp, perpetuals.length);
    }

    /// @notice Pause the contract
    function pause() external override onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external override onlyOwner {
        _unpause();
    }

    /// @notice Sell dust in market idx
    /// @param idx Index of the perpetual market
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    /// @param token Token of the collateral
    function sellDust(
        uint256 idx,
        uint256 proposedAmount,
        uint256 minAmount,
        IERC20 token
    ) external override onlyOwner {
        (, , int256 profit) = perpetuals[idx].reducePosition(
            address(this),
            FULL_REDUCTION_RATIO,
            proposedAmount,
            minAmount
        );

        // apply changes to collateral
        vault.settleProfit(1, address(this), profit, true);

        // withdraw
        require(vault.withdrawAll(1, address(this), token, true) > 0);
        IERC20(token).safeTransfer(msg.sender, IERC20(token).balanceOf(address(this)));

        emit DustSold(idx, profit);
    }

    /// @notice Remove insurance fees exceeding 10% of the TVL from the vault
    /// @param amount Token withdrawn. 18 decimals
    /// @param token Token to be withdrawn from the vault
    function removeInsurance(uint256 amount, IERC20 token) external override onlyOwner {
        uint256 tvl = vault.getTotalReserveToken();

        require(vault.withdraw(0, address(this), amount, token, true) > 0, "Unsuccessful withdrawal");
        IERC20(token).safeTransfer(msg.sender, IERC20(token).balanceOf(address(this)));

        uint256 lockedInsurance = vault.getTraderBalance(0, address(this)).toUint256();

        require(lockedInsurance >= tvl.wadMul(INSURANCE_RATIO), "Insurance is not enough");

        emit InsuranceRemoved(amount);
    }

    /* ****************** */
    /*   Market viewer    */
    /* ****************** */

    /// @notice Return the number of active markets
    /// @return Number of active markets
    function getNumMarkets() external view override returns (uint256) {
        return perpetuals.length;
    }

    /* ****************** */
    /*   User getter      */
    /* ****************** */

    function _getFundingPayments(uint256 idx, address account) internal view returns (int256 upcomingFundingPayment) {
        return perpetuals[idx].getFundingPayments(account);
    }

    function _getUnrealizedPnL(uint256 idx, address account) internal view returns (int256) {
        return perpetuals[idx].getUnrealizedPnL(account);
    }

    function _getTraderReserveValue(uint256 idx, address account) internal view returns (int256) {
        return vault.getTraderReserveValue(idx, account);
    }

    function _getTraderPosition(uint256 idx, address account) internal view returns (LibPerpetual.UserPosition memory) {
        return perpetuals[idx].getTraderPosition(account);
    }

    function _marginRatio(
        int256 collateral,
        int256 fundingPayments,
        int256 unrealizedPositionPnl,
        int256 openNotional
    ) internal pure returns (int256) {
        return (collateral + unrealizedPositionPnl + fundingPayments).wadDiv(openNotional.abs());
    }
}
