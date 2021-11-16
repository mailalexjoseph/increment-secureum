// SPDX-License-Identifier: MIT

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

pragma solidity 0.8.4;

// @dev: deposit uint and withdraw int
// @author: The interface used in other contracts

interface IVault {
    event Deposit(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);

    function deposit(uint256 amount, IERC20 token) external;

    function withdraw(uint256 amount, IERC20 token) external;

    function getReserveValue(address account) external view returns (int256);
}
