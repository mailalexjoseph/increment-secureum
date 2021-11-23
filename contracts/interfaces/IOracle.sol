// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

interface IOracle {
    // function addAggregator(bytes32 priceFeedKey, address aggregator) external;

    // function removeAggregator(bytes32 priceFeedKey) external;

    function getAssetPrice(address asset) external view returns (int256);
}
