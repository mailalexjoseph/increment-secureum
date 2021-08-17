// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

/// @notice Describes all complex types

library PTypes {
    struct UserPosition {
        mapping(address => uint256) userReserve;
        uint256 quoteLong;
        uint256 quoteShort;
        uint256 usdNotional;
    }

    struct Index {
        uint256 timeStamp;
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
