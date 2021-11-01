// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {FeedRegistryInterface} from "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";
import {IOracle} from "./interfaces/IOracle.sol";

contract Oracle is IOracle {
    FeedRegistryInterface private registry;

    constructor(address _registry) {
        registry = FeedRegistryInterface(_registry);
    }

    // key by currency symbol, eg ETH
    mapping(bytes32 => AggregatorV3Interface) public priceFeedMap;
    bytes32[] public priceFeedKeys;

    /****************************** Funding Rate ******************************/

    function getAssetPrice(address asset) external view override returns (int256) {}
}

/*     function addAggregator(bytes32 _priceFeedKey, address _aggregator) external override {
        require(_aggregator != address(0));
        if (address(priceFeedMap[_priceFeedKey]) == address(0)) {
            priceFeedKeys.push(_priceFeedKey);
        }
        priceFeedMap[_priceFeedKey] = AggregatorV3Interface(_aggregator);
    }

    function removeAggregator(bytes32 _priceFeedKey) external override {
        require(_priceFeedKey != bytes32(0));
        delete priceFeedMap[_priceFeedKey];

        uint256 length = priceFeedKeys.length;
        for (uint256 i; i < length; i++) {
            if (priceFeedKeys[i] == _priceFeedKey) {
                // if the removal item is the last one, just `pop`
                if (i != length - 1) {
                    priceFeedKeys[i] = priceFeedKeys[length - 1];
                }
                priceFeedKeys.pop();
                break;
            }
        }
    }

*/
