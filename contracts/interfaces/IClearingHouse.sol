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
    /* ****************** */
    /*     Viewer         */
    /* ****************** */

    function vault() external view returns (IVault);

    function insurance() external view returns (IInsurance);

    function perpetuals(uint256 idx) external view returns (IPerpetual);

    function getNumMarkets() external view returns (uint256);

    function marginIsValid(
        uint256 idx,
        address account,
        int256 ratio
    ) external view returns (bool);

    function marginRatio(uint256 idx, address account) external view returns (int256);

    /* ****************** */
    /*  State modifying   */
    /* ****************** */

    function allowListPerpetual(IPerpetual perp) external;

    function pause() external;

    function unpause() external;

    function sellDust(
        uint256 idx,
        uint256 proposedAmount,
        uint256 minAmount,
        IERC20 token
    ) external;

    function removeInsurance(uint256 amount, IERC20 token) external;

    function deposit(
        uint256 idx,
        uint256 amount,
        IERC20 token
    ) external;

    function withdraw(
        uint256 idx,
        uint256 amount,
        IERC20 token
    ) external;

    function extendPositionWithCollateral(
        uint256 idx,
        uint256 collateralAmount,
        IERC20 token,
        uint256 positionAmount,
        LibPerpetual.Side direction,
        uint256 minAmount
    ) external returns (int256, int256);

    function extendPosition(
        uint256 idx,
        uint256 amount,
        LibPerpetual.Side direction,
        uint256 minAmount
    ) external returns (int256, int256);

    function closePositionWithdrawCollateral(
        uint256 idx,
        uint256 proposedAmount,
        uint256 minAmount,
        IERC20 token
    ) external;

    function reducePosition(
        uint256 idx,
        uint256 reductionRatio,
        uint256 proposedAmount,
        uint256 minAmount
    ) external;

    function liquidate(
        uint256 idx,
        address liquidatee,
        uint256 proposedAmount
    ) external;

    function provideLiquidity(
        uint256 idx,
        uint256 amount,
        uint256 minLpAmount,
        IERC20 token
    ) external returns (uint256, uint256);

    function removeLiquidity(
        uint256 idx,
        uint256 liquidityAmountToRemove,
        uint256 reductionRatio,
        uint256 proposedAmount,
        uint256 minAmount,
        IERC20 token
    ) external;
}
