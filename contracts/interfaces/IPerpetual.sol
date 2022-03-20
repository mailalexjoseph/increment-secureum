// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// interfaces
import {ICryptoSwap} from "./ICryptoSwap.sol";
import {IVault} from "./IVault.sol";
import {ICryptoSwap} from "./ICryptoSwap.sol";
import {IVBase} from "./IVBase.sol";
import {IVQuote} from "./IVQuote.sol";
import {IInsurance} from "./IInsurance.sol";
import {IClearingHouse} from "./IClearingHouse.sol";

// libraries
import {LibPerpetual} from "../lib/LibPerpetual.sol";

interface IPerpetual {
    /// @notice Emitted when swap with cryptoswap pool fails
    /// @param errorMessage Return error message
    event Log(string errorMessage);

    /// @notice Emitted when (base) dust is generated
    /// @param vBaseAmount Amount of dust
    event DustGenerated(uint256 vBaseAmount);

    function market() external view returns (ICryptoSwap);

    function vBase() external view returns (IVBase);

    function vQuote() external view returns (IVQuote);

    function clearingHouse() external view returns (IClearingHouse);

    // buy/ sell functions

    function extendPosition(
        address account,
        uint256 amount,
        LibPerpetual.Side direction,
        uint256 minAmount
    )
        external
        returns (
            int256,
            int256,
            int256
        );

    function reducePosition(
        address account,
        uint256 reductionRatio,
        uint256 amount,
        uint256 minAmount
    )
        external
        returns (
            int256,
            int256,
            int256
        );

    // user position function
    function getTraderPosition(address account) external view returns (LibPerpetual.UserPosition memory);

    function getLpPosition(address account) external view returns (LibPerpetual.UserPosition memory);

    function getGlobalPosition() external view returns (LibPerpetual.GlobalPosition memory);

    function getUnrealizedPnL(address account) external view returns (int256);

    function getFundingPayments(address account) external view returns (int256);

    // liquidator provider functions
    function provideLiquidity(address account, uint256 wadAmount) external returns (uint256, int256);

    function removeLiquidity(
        address account,
        uint256 liquidityAmountToRemove,
        uint256 reductionRatio,
        uint256 proposedAmount,
        uint256 minAmount
    )
        external
        returns (
            int256,
            int256,
            int256
        );

    // price getter
    function getExpectedVBaseAmount(uint256 vQuoteAmountToSpend) external view returns (uint256);

    function getExpectedVQuoteAmount(uint256 vBaseAmountToSpend) external view returns (uint256);

    function marketPriceOracle() external view returns (uint256);

    function marketPrice() external view returns (uint256);

    function indexPrice() external view returns (int256);
}
