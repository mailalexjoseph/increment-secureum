// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contract
import {ICryptoSwap} from "./ICryptoSwap.sol";
import {PoolTWAPOracle} from "../oracles/PoolTWAPOracle.sol";
import {ChainlinkTWAPOracle} from "../oracles/ChainlinkTWAPOracle.sol";

// interfaces
import {IVault} from "./IVault.sol";
import {ICryptoSwap} from "./ICryptoSwap.sol";
import {IChainlinkOracle} from "./IChainlinkOracle.sol";
import {IVirtualToken} from "./IVirtualToken.sol";
import {IInsurance} from "./IInsurance.sol";
import {IClearingHouse} from "./IClearingHouse.sol";
// libraries
import {LibPerpetual} from "../lib/LibPerpetual.sol";

interface IPerpetual {
    event Settlement(address indexed user, int256 amount);
    event OpenPosition(
        address indexed user,
        uint128 indexed timeStamp,
        LibPerpetual.Side direction,
        int256 notional,
        int256 amount
    );
    event ClosePosition(
        address indexed user,
        uint128 indexed timeStamp,
        LibPerpetual.Side direction,
        int256 notional,
        int256 amount
    );
    event LiquidationCall(address indexed liquidatee, address indexed liquidator, uint128 timestamp, uint256 notional);
    event FundingPayment(uint256 indexed blockNumber, uint256 value, bool isPositive);
    event LiquidityProvided(address indexed liquidityProvider, address indexed asset, uint256 amount);
    event LiquidityRemoved(address indexed liquidityProvider, uint256 amount);
    event LiquidityWithdrawn(address indexed liquidityProvider);
    event Log(string errorMessage);

    event TokenDonated(address indexed burner, uint256 vBaseAmount, uint256 liquidity);

    function market() external view returns (ICryptoSwap);

    function chainlinkOracle() external view returns (IChainlinkOracle);

    function poolTWAPOracle() external view returns (PoolTWAPOracle);

    function chainlinkTWAPOracle() external view returns (ChainlinkTWAPOracle);

    function vBase() external view returns (IVirtualToken);

    function vQuote() external view returns (IVirtualToken);

    function clearingHouse() external view returns (IClearingHouse);

    // buy/ sell functions

    function openPosition(
        address account,
        uint256 amount,
        LibPerpetual.Side direction,
        uint256 minAmount
    ) external returns (int256, int256);

    function closePosition(
        address account,
        uint256 amount,
        uint256 minAmount
    ) external returns (int256);

    // user position function
    function getTraderPosition(address account) external view returns (LibPerpetual.UserPosition memory);

    function getLpPosition(address account) external view returns (LibPerpetual.UserPosition memory);

    function getGlobalPosition() external view returns (LibPerpetual.GlobalPosition memory);

    function getUnrealizedPnL(address account) external view returns (int256);

    function getFundingPayments(address account) external view returns (int256);

    // liquidator provider functions
    function provideLiquidity(address account, uint256 wadAmount) external returns (uint256);

    function removeLiquidity(address account, uint256 amount) external;

    function settleAndWithdrawLiquidity(address account, uint256 tentativeVQuoteAmount) external returns (int256);

    // price getter
    function getExpectedVBaseAmount(uint256 vQuoteAmountToSpend) external view returns (uint256);

    function getExpectedVQuoteAmount(uint256 vBaseAmountToSpend) external view returns (uint256);

    function marketPriceOracle() external view returns (uint256);

    function marketPrice() external view returns (uint256);

    function indexPrice() external view returns (int256);
}
