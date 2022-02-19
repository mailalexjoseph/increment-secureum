// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IChainlinkOracle} from "./IChainlinkOracle.sol";
import {IInsurance} from "./IInsurance.sol";
import {IClearingHouse} from "./IClearingHouse.sol";

// @dev: deposit uint and withdraw int
// @author: The interface used in other contracts
interface IVault {
    function chainlinkOracle() external view returns (IChainlinkOracle);

    function reserveToken() external view returns (IERC20);

    function insurance() external view returns (IInsurance);

    function clearingHouse() external view returns (IClearingHouse);

    function totalReserveToken() external view returns (uint256);

    function badDebt() external view returns (uint256);

    function deposit(
        uint256 idx,
        address user,
        uint256 amount,
        IERC20 token
    ) external returns (uint256);

    function withdrawAll(
        uint256 idx,
        address user,
        IERC20 withdrawToken
    ) external returns (uint256);

    function withdraw(
        uint256 idx,
        address user,
        uint256 amount,
        IERC20 token
    ) external returns (uint256);

    function getReserveValue(uint256 idx, address account) external view returns (int256);

    function getReserveTokenDecimals() external view returns (uint256);

    function settleProfit(
        uint256 idx,
        address user,
        int256 amount
    ) external;

    function getBalance(uint256 idx, address user) external view returns (int256);
}
