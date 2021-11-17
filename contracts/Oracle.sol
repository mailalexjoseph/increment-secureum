// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {FeedRegistryInterface} from "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";
import {IOracle} from "./interfaces/IOracle.sol";
import {PRBMathSD59x18} from "prb-math/contracts/PRBMathSD59x18.sol";

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

contract Oracle is IOracle {
    using SafeCast for uint256;
    FeedRegistryInterface private registry;

    uint8 constant DECIMALS = 18;

    constructor(address _registry) {
        registry = FeedRegistryInterface(_registry);
    }

    // key by currency symbol, eg ETH
    mapping(bytes32 => AggregatorV3Interface) public priceFeedMap;
    bytes32[] public priceFeedKeys;

    /****************************** Funding Rate ******************************/

    function getAssetPrice(address asset) external view override returns (int256) {
        bytes32 key = bytes20(asset);
        AggregatorV3Interface chainlinkInterface = priceFeedMap[key];
        uint8 chainlinkDecimals = chainlinkInterface.decimals();
        (, int256 price, , uint256 timeStamp, ) = chainlinkInterface.latestRoundData();
        // If the round is not complete yet, timestamp is 0
        require(timeStamp > 0, "Round not complete");
        require(price > 0, "Integer conversion failed");
        uint256 scaledPrice = (uint256(price) + (uint256(timeStamp)) * DECIMALS) / chainlinkDecimals;
        return scaledPrice.toInt256();
    }

    function addAggregator(bytes32 _priceFeedKey, address _aggregator) external {
        require(_aggregator != address(0));
        if (address(priceFeedMap[_priceFeedKey]) == address(0)) {
            priceFeedKeys.push(_priceFeedKey);
        }
        priceFeedMap[_priceFeedKey] = AggregatorV3Interface(_aggregator);
    }

    function removeAggregator(bytes32 _priceFeedKey) external {
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
}
