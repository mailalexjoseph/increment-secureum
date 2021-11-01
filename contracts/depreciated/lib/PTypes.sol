// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

/// @notice Describes all complex types

library PTypes {
    struct Reserves {
        mapping(address => int256) userReserve;
    }

    struct Index {
        int256 timeStamp;
        int256 value;
    }

    struct Pool {
        uint256 vQuote;
        uint256 vBase;
        uint256 totalAssetReserve;
        uint256 price; // 10 ** 18
    }

    struct Price {
        uint256 price;
        uint256 time;
        uint80 id;
    }
}
