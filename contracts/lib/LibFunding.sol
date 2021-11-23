// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

// dependencies
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

// interfaces
import {IPerpetual} from "../interfaces/IPerpetual.sol";

// libraries
import {LibMath} from "./LibMath.sol";
import {LibPerpetual} from "./LibPerpetual.sol";

import "hardhat/console.sol";

// see: UniswapV3, Position Library
// /// @notice Returns the Info struct of a position, given an owner and position boundaries
// /// @param self The mapping containing all user positions
// /// @param owner The address of the position owner
// /// @param tickLower The lower tick boundary of the position
// /// @param tickUpper The upper tick boundary of the position
// /// @return position The position info struct of the given owners' position
// function get(
//     mapping(bytes32 => Info) storage self,
//     address owner,
//     int24 tickLower,
//     int24 tickUpper
// ) internal view returns (Position.Info storage position) {
//     position = self[keccak256(abi.encodePacked(owner, tickLower, tickUpper))];
// }

library LibFunding {
    using LibMath for int256;
    using LibMath for uint256;

    struct Price {
        uint128 roundId;
        uint128 timeStamp;
        int256 price;
    }

    function getChainlinkTWAP(int256 _delta, AggregatorV3Interface chainlinkOracle) internal view returns (int256) {
        require(address(chainlinkOracle) != address(0));

        // get last price
        (uint80 roundId, int256 price, , uint256 timeStamp, ) = chainlinkOracle.latestRoundData();
        require(price > 0, "Negative price");

        // get start and end of period
        uint256 latestDate = block.timestamp;
        uint256 earliestDate = latestDate - uint256(_delta);

        // initialize loop
        uint256 oldTimeStap = timeStamp;
        uint80 newRoundId;
        int256 weighedAveragePrice;

        if (timeStamp < earliestDate) {
            // return if too early
            return price;
        }

        // go from latest date to earliest
        while (timeStamp >= earliestDate) {
            if (roundId <= 0) {
                return price;
            }
            // get id of price call before
            newRoundId = roundId - 1;
            (roundId, price, timeStamp, , ) = chainlinkOracle.getRoundData(newRoundId);
            require(price > 0, "Negative price");
            // weight by time
            weighedAveragePrice += int256(oldTimeStap - timeStamp) * price;
        }
        return weighedAveragePrice / _delta;
    }

    function getPoolTWAP(int256 _delta, IPerpetual perpetual) internal view returns (int256) {
        // get last price
        LibPerpetual.Price memory price = perpetual.getLatestPrice();

        // get last price
        require(price.price > 0, "Negative price");

        // get start and end of period
        uint256 latestDate = block.timestamp;
        uint256 earliestDate = latestDate - uint256(_delta);

        // initialize loop
        uint256 oldTimeStap = uint256(price.timeStamp);
        uint256 newRoundId;
        int256 weighedAveragePrice;

        // return if too early
        if (price.timeStamp < earliestDate) {
            return price.price;
        }

        // go from latest date to earliest
        while (price.timeStamp >= earliestDate) {
            if (price.roundId <= 0) {
                return price.price;
            }
            // get id of price call before
            newRoundId = price.roundId - 1;
            price = perpetual.getPrice(newRoundId);

            // weight by time
            weighedAveragePrice += int256(oldTimeStap - price.timeStamp) * price.price;
        }
        return weighedAveragePrice / _delta;
    }
}
