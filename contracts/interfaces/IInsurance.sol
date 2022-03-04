// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

interface IInsurance {
    event DebtSettled(address indexed user, uint256 amount);
    event LiquidityWithdrawn(uint256 amount);

    function settleDebt(uint256 amount) external;

    function withdrawRemainder() external;
}
