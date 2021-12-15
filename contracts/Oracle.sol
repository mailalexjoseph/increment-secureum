// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// dependencies
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {FeedRegistryInterface} from "@chainlink/contracts/src/v0.8/interfaces/FeedRegistryInterface.sol";
import {PRBMathSD59x18} from "prb-math/contracts/PRBMathSD59x18.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IncreOwnable} from "./utils/IncreOwnable.sol";

// interfaces
import {IOracle} from "./interfaces/IOracle.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";

contract Oracle is IOracle, IncreOwnable {
    using SafeCast for uint256;
    FeedRegistryInterface private registry;

    uint8 constant OUT_DECIMALS = 18;

    constructor(address _registry) {
        registry = FeedRegistryInterface(_registry);
    }

    // key by currency symbol, eg ETH
    mapping(address => AggregatorV3Interface) public priceFeedMap;
    address[] public priceFeedKeys;

    /****************************** Funding Rate ******************************/

    function getIndexPrice() external view override returns (int256) {
        AggregatorV3Interface chainlinkInterface = priceFeedMap[msg.sender];
        require(address(chainlinkInterface) != address(0));
        return _chainlinkPrice(chainlinkInterface);
    }

    function getAssetPrice(address asset) external view override returns (int256) {
        AggregatorV3Interface chainlinkInterface = priceFeedMap[asset];
        require(address(chainlinkInterface) != address(0));
        return _chainlinkPrice(chainlinkInterface);
    }

    function _chainlinkPrice(AggregatorV3Interface chainlinkInterface) public view returns (int256) {
        uint8 chainlinkDecimals = chainlinkInterface.decimals();
        (, int256 price, , uint256 timeStamp, ) = chainlinkInterface.latestRoundData();
        // If the round is not complete yet, timestamp is 0
        require(timeStamp > 0, "Round not complete");
        require(price > 0, "Integer conversion failed");
        int256 scaledPrice = (price * int256(10**(OUT_DECIMALS - chainlinkDecimals)));
        return scaledPrice;
    }

    function addAggregator(address _asset, address _aggregator) external override onlyOwner {
        require(_asset != address(0));
        if (address(priceFeedMap[_asset]) == address(0)) {
            priceFeedKeys.push(_asset);
        }
        priceFeedMap[_asset] = AggregatorV3Interface(_aggregator);
    }

    function removeAggregator(address _asset) external override onlyOwner {
        require(_asset != address(0));
        delete priceFeedMap[_asset];

        uint256 length = priceFeedKeys.length;
        for (uint256 i; i < length; i++) {
            if (priceFeedKeys[i] == _asset) {
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
