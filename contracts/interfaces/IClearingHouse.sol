// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// interfaces
import {IClearingHouse} from "./IClearingHouse.sol";
import {IPerpetual} from "./IPerpetual.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVault} from "./IVault.sol";
import {ICryptoSwap} from "./ICryptoSwap.sol";
import {IInsurance} from "./IInsurance.sol";

// libraries
import {LibPerpetual} from "../lib/LibPerpetual.sol";

interface IClearingHouse {
    event MarketAdded(IPerpetual indexed perpetual, uint256 numPerpetuals);
    event Deposit(uint256 indexed idx, address indexed user, address indexed asset, uint256 amount);
    event Withdraw(uint256 indexed idx, address indexed user, address indexed asset, uint256 amount);
    event ExtendPosition(
        uint256 indexed idx,
        address indexed user,
        uint128 indexed timeStamp,
        LibPerpetual.Side direction,
        int256 addedOpenNotional,
        int256 addedPositionSize
    );
    event ReducePosition(
        uint256 indexed idx,
        address indexed user,
        uint128 indexed timeStamp,
        int256 reducedOpenNotional,
        int256 reducedPositionSize
    );
    event LiquidationCall(
        uint256 indexed idx,
        address indexed liquidatee,
        address indexed liquidator,
        uint128 timestamp,
        uint256 notional
    );
    event FundingPayment(uint256 indexed idx, uint256 indexed blockNumber, uint256 value, bool isPositive);
    event LiquidityProvided(
        uint256 indexed idx,
        address indexed liquidityProvider,
        address indexed asset,
        uint256 amount
    );
    event LiquidityRemoved(
        uint256 indexed idx,
        address indexed liquidityProvider,
        uint256 removedLiquidity,
        int256 vQuoteProceeds,
        int256 vBaseAmount,
        int256 profit,
        address indexed asset
    );
    event Log(string errorMessage);

    // dependencies
    function vault() external view returns (IVault);

    function insurance() external view returns (IInsurance);

    function perpetuals(uint256 idx) external view returns (IPerpetual);

    // functions
    function allowListPerpetual(IPerpetual perp) external;

    function pause() external;

    function unpause() external;

    function sellDust(
        uint256 idx,
        uint256 proposedAmount,
        uint256 minAmount
    ) external;

    function removeInsurance(
        uint256 idx,
        uint256 amount,
        IERC20 token
    ) external;

    ///// TRADER FLOW OPERATIONS \\\\\

    /// @notice Deposit tokens into the vault
    /// @param idx Index of the perpetual market
    /// @param amount Amount to be used as collateral. Might not be 18 decimals
    /// @param token Token to be used for the collateral
    function deposit(
        uint256 idx,
        uint256 amount,
        IERC20 token,
        bool isTrader
    ) external;

    /// @notice Withdraw tokens from the vault
    /// @param idx Index of the perpetual market
    /// @param amount Amount of collateral to withdraw. Might not be 18 decimals
    /// @param token Token of the collateral
    function withdraw(
        uint256 idx,
        uint256 amount,
        IERC20 token,
        bool isTrader
    ) external;

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
    ) external returns (int256, int256);

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
    ) external returns (int256, int256);

    /// @notice Reduces, or closes in full, a position from an account holder
    /// @param idx Index of the perpetual market
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    /// @param minAmount Minimum amount that the user is willing to accept, in vQuote if LONG, in vBase if SHORT. 18 decimals
    function reducePosition(
        uint256 idx,
        uint256 reductionRatio,
        uint256 proposedAmount,
        uint256 minAmount
    ) external;

    /// @notice Determines whether or not a position is valid for a given margin ratio
    /// @param idx Index of the perpetual market
    /// @param account Account of the position to get the margin ratio from
    /// @param ratio Proposed ratio to compare the position against
    function marginIsValid(
        uint256 idx,
        address account,
        int256 ratio
    ) external view returns (bool);

    /// @notice Get the margin ratio of a trading position (given that, for now, 1 trading position = 1 address)
    /// @param idx Index of the perpetual market
    /// @param account Account of the position to get the margin ratio from
    function marginRatio(uint256 idx, address account) external view returns (int256);

    /// @notice Submit the address of a trader whose position is worth liquidating for a reward
    /// @param idx Index of the perpetual market
    /// @param liquidatee Address of the trader to liquidate
    /// @param proposedAmount Amount of tokens to be sold, in vBase if LONG, in vQuote if SHORT. 18 decimals
    function liquidate(
        uint256 idx,
        address liquidatee,
        uint256 proposedAmount
    ) external;

    ///// LIQUIDITY PROVISIONING FLOW OPERATIONS \\\\\

    /// @notice Provide liquidity to the pool
    /// @param idx Index of the perpetual market
    /// @param amount Amount of token to be added to the pool. Might not have 18 decimals
    /// @param token Token to be added to the pool
    function provideLiquidity(
        uint256 idx,
        uint256 amount,
        IERC20 token
    ) external returns (uint256, uint256);

    /// @notice Remove liquidity from the pool
    /// @param idx Index of the perpetual market
    /// @param liquidityAmountToRemove Amount of liquidity (in LP tokens) to be removed from the pool. 18 decimals
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
    ) external;

    /// @notice Return amount for vBase one would receive for exchanging `vQuoteAmountToSpend` in a select market (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `extendPosition`
    /// @param idx Index of the perpetual market
    /// @param vQuoteAmountToSpend Amount of vQuote to be exchanged against some vBase. 18 decimals
    function getExpectedVBaseAmount(uint256 idx, uint256 vQuoteAmountToSpend) external view returns (uint256);

    /// @notice Return amount for vQuote one would receive for exchanging `vBaseAmountToSpend` in a select market (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `extendPosition`
    /// @param idx Index of the perpetual market
    /// @param vBaseAmountToSpend Amount of vBase to be exchanged against some vQuote. 18 decimals
    function getExpectedVQuoteAmount(uint256 idx, uint256 vBaseAmountToSpend) external view returns (uint256);

    /// @notice Calculate missed funding payments
    // slither-disable-next-line timestamp
    /// @param idx Index of the perpetual market
    /// @param account Trader to get the funding payments
    function getFundingPayments(uint256 idx, address account) external view returns (int256 upcomingFundingPayment);

    /// @param idx Index of the perpetual market
    /// @param account Trader to get the unrealized PnL from
    function getUnrealizedPnL(uint256 idx, address account) external view returns (int256);

    /// @notice Get the portfolio value of an account
    /// @param idx Index of the perpetual market
    /// @param account Address to get the portfolio value from
    function getReserveValue(uint256 idx, address account) external view returns (int256);

    /// @notice Return the curve price oracle
    /// @param idx Index of the perpetual market
    function marketPriceOracle(uint256 idx) external view returns (uint256);

    /// @notice Return the last traded price (used for TWAP)
    /// @param idx Index of the perpetual market
    function marketPrice(uint256 idx) external view returns (uint256);

    /// @notice Return the current off-chain exchange rate for vBase/vQuote
    /// @param idx Index of the perpetual market
    function indexPrice(uint256 idx) external view returns (int256);

    /// @param idx Index of the perpetual market
    function getGlobalPosition(uint256 idx) external view returns (LibPerpetual.GlobalPosition memory);

    /// @param idx Index of the perpetual market
    /// @param account Address to get the trading position from
    function getTraderPosition(uint256 idx, address account) external view returns (LibPerpetual.UserPosition memory);

    /// @param idx Index of the perpetual market
    /// @param account Address to get the LP position from
    function getLpPosition(uint256 idx, address account) external view returns (LibPerpetual.UserPosition memory);

    function getNumMarkets() external view returns (uint256);
}
