// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// contracts
import {IncreOwnable} from "../utils/IncreOwnable.sol";

// libraries
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {PRBMathSD59x18} from "prb-math/contracts/PRBMathSD59x18.sol";

// interfaces
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {FeedRegistryInterface} from "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";
import {IChainlinkOracle} from "../interfaces/IChainlinkOracle.sol";
import {IPerpetual} from "../interfaces/IPerpetual.sol";

contract ChainlinkOracle is IChainlinkOracle, IncreOwnable {
    using SafeCast for uint256;

    uint8 constant OUT_DECIMALS = 18;

    constructor() {}

    // key by currency symbol, eg ETH
    mapping(address => AggregatorV3Interface) public priceFeedMap;
    address[] public priceFeedKeys;

    /****************************** Funding Rate ******************************/

    function getIndexPrice() external view override returns (int256) {
        AggregatorV3Interface chainlinkInterface = priceFeedMap[msg.sender];
        require(address(chainlinkInterface) != address(0));
        return chainlinkPrice(chainlinkInterface);
    }

    function getAssetPrice(address asset) external view override returns (int256) {
        AggregatorV3Interface chainlinkInterface = priceFeedMap[asset];
        require(address(chainlinkInterface) != address(0));
        return chainlinkPrice(chainlinkInterface);
    }

    function chainlinkPrice(AggregatorV3Interface chainlinkInterface) public view returns (int256) {
        uint8 chainlinkDecimals = chainlinkInterface.decimals();
        (, int256 price, , uint256 timeStamp, ) = chainlinkInterface.latestRoundData();
        // If the round is not complete yet, timestamp is 0
        require(timeStamp > 0, "Round not complete");
        require(price > 0, "Integer conversion failed");
        int256 scaledPrice = (price * int256(10**(OUT_DECIMALS - chainlinkDecimals)));
        return scaledPrice;
    }

    function addAggregator(address asset, address aggregator) external override onlyOwner {
        require(asset != address(0));
        if (address(priceFeedMap[asset]) == address(0)) {
            priceFeedKeys.push(asset);
        }
        priceFeedMap[asset] = AggregatorV3Interface(aggregator);
    }

    function removeAggregator(address asset) external override onlyOwner {
        require(asset != address(0));
        delete priceFeedMap[asset];

        uint256 length = priceFeedKeys.length;
        for (uint256 i = 0; i < length; i++) {
            if (priceFeedKeys[i] == asset) {
                // if the removal item is the last one, just `pop`
                if (i != length - 1) {
                    priceFeedKeys[i] = priceFeedKeys[length - 1];
                }
                //slither-disable-next-line costly-loop
                priceFeedKeys.pop();
                break;
            }
        }
    }
}
