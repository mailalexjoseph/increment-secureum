// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

// libraries
import "../lib/LibFunding.sol";

contract TestLibFunding {
    function getChainlinkTWAP(int256 _delta, AggregatorV3Interface chainlinkOracle) external view returns (int256) {
        return LibFunding.getChainlinkTWAP(_delta, chainlinkOracle);
    }

    function getPoolTWAP(int256 _delta, IPerpetual perpetual) external view returns (int256) {
        return LibFunding.getPoolTWAP(_delta, perpetual);
    }
}
