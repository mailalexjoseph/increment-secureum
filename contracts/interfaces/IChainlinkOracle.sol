// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface IChainlinkOracle {
    function addAggregator(address asset, AggregatorV3Interface aggregator) external;

    function removeAggregator(address asset) external;

    function getAssetPrice(address asset) external view returns (int256);

    function getIndexPrice() external view returns (int256);
}
