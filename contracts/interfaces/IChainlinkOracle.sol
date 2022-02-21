// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

interface IChainlinkOracle {
    function addAggregator(address asset, address aggregator) external;

    function removeAggregator(address asset) external;

    function getAssetPrice(address asset) external view returns (int256);

    function getIndexPrice() external view returns (int256);
}
