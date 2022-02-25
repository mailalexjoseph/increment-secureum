// SPDX-License-Identifier: AGPL-3.0
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

    uint8 constant PRECISION = 18;

    constructor() {}

    AggregatorV3Interface public chainlinkAggregator;

    /****************************** Funding Rate ******************************/

    function getAssetPrice() external view override returns (int256) {
        uint8 chainlinkDecimals = chainlinkAggregator.decimals();
        (, int256 price, , uint256 timeStamp, ) = chainlinkAggregator.latestRoundData();
        // If the round is not complete yet, timestamp is 0
        require(timeStamp > 0, "Round not complete");
        require(price > 0, "Integer conversion failed");
        int256 scaledPrice = (price * int256(10**(PRECISION - chainlinkDecimals)));
        return scaledPrice;
    }

    function addAggregator(AggregatorV3Interface aggregator) external override onlyOwner {
        require(aggregator.decimals() <= PRECISION, "Decimals too large");
        chainlinkAggregator = aggregator;
    }
}
