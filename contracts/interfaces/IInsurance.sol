// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

interface IInsurance {
    /// @notice Emitted when insurance reserves are withdrawn by governance
    /// @param amount Amount of insurance reserves withdrawn
    event LiquidityWithdrawn(uint256 amount);

    function settleDebt(uint256 amount) external;

    function withdrawRemainder() external;
}
