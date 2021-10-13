// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

interface IPerpetual {
    struct Price {
        uint128 roundId;
        uint128 timeStamp;
        int256 price;
    }

    function getAllPeriods() external view returns (uint256);

    function getLatestPrice() external view returns (Price memory);

    function getPrice(uint256 _period) external view returns (Price memory);
}
