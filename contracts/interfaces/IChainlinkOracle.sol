// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

interface IChainlinkOracle {
    function getAssetPrice() external view returns (int256);

    function addAggregator(AggregatorV3Interface aggregator) external;
}
