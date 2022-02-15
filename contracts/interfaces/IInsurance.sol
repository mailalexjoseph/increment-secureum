// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

interface IInsurance {
    function settleDebt(uint256 amount) external;

    function withdrawRemainder() external;
}
