// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

// @dev: deposit uint and withdraw int
// @author: only allows one type of collateral
interface IVault {
    event Deposit(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);

    function deposit(uint256 amount, address token) external;

    function withdraw(uint256 amount, address token) external;

    function getReserveValue(address account) external view returns (int256);

    function getAssetValue(address account, address asset) external view returns (int256);

    function applyFundingPayment(address account, int256 upcomingFundingPayment) external;
}
