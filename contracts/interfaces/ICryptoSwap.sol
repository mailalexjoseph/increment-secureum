// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface ICryptoSwap {
    // Swap token i to j with amount dx and min amount min_dy
    function exchange(
        uint256 i,
        uint256 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
}
