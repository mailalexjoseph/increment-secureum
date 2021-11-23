// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

// dependencies
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// @dev: deposit uint and withdraw int
// @author: The interface used in other contracts
interface IVault {
    function deposit(
        address user,
        uint256 amount,
        IERC20 token
    ) external;

    function withdraw(
        address user,
        uint256 amount,
        IERC20 token
    ) external;

    function getReserveValue(address account) external view returns (int256);

    function settleProfit(address user, int256 amount) external returns (int256);
}
