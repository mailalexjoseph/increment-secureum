// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {PerpetualTypes} from "../lib/PerpetualTypes.sol";
import {SignedMath} from "../lib/SignedMath.sol";
import {Getter} from "./Getter.sol";

import "hardhat/console.sol";

/// @notice Calculates funding rates (uses Signed Math library of dYdX)
/// @dev revamp modular structure to minimize state reads

contract Funding is Getter, Ownable {
    using SignedMath for SignedMath.Int;

    // events
    event LogSnapshot(uint256 indexed blockNumber, uint256 price, uint80 id);

    event LogFundingPayment(uint256 indexed blockNumber, uint256 value, bool isPositive);

    /****************************** Funding Rate ******************************/

    function getPoolTWAP(uint256 _delta) internal view returns (uint256) {
        // find length of periods with price snapshots
        uint256 numTotalPeriod = prices.length;
        //console.log("numTotalPeriod is", numTotalPeriod);
        // get last price
        PerpetualTypes.Price memory poolPrice = prices[numTotalPeriod - 1];
        //console.log("poolPrice is", poolPrice);
        // derive TWAP
        return calcTWAP(_delta, poolPrice.id, poolPrice.price, poolPrice.time, _getVAMMPriceById);
    }

    function getChainlinkTWAP(uint256 _delta) internal view returns (uint256) {
        // get price oracle
        AggregatorV3Interface chainlinkOracle = AggregatorV3Interface(quoteAssetOracle);

        // get last price
        (uint80 roundId, int256 price, , uint256 timeStamp, ) = chainlinkOracle.latestRoundData();
        require(price > 0, "Negative price");

        // derive TWAP
        return calcTWAP(_delta, roundId, uint256(price), timeStamp, _getChainlinkPriceById);
    }

    function calcTWAP(
        uint256 delta,
        uint80 roundId,
        uint256 price,
        uint256 timeStamp,
        function(uint80) internal view returns (uint80, uint256, uint256) getNextPrice
    ) internal view returns (uint256) {
        // get start and end of period
        uint256 latestDate = block.timestamp;
        uint256 earliestDate = latestDate - delta;

        // initialize loop
        uint256 oldTimeStap = timeStamp;
        uint80 newRoundId;
        uint256 weighedAveragePrice;

        // return if too early
        if (timeStamp < earliestDate) {
            return price;
        }

        // go from latest date to earliest
        while (timeStamp >= earliestDate) {
            if (roundId <= 0) {
                return price;
            }
            // get id of price call before
            newRoundId = roundId - 1;
            (roundId, price, timeStamp) = getNextPrice(newRoundId);
            // weight by time
            weighedAveragePrice += (oldTimeStap - timeStamp) * price;
        }
        return weighedAveragePrice / delta;
    }

    function _getChainlinkPriceById(uint80 id)
        internal
        view
        returns (
            uint80,
            uint256,
            uint256
        )
    {
        /// @dev: replace repeated state reads
        AggregatorV3Interface chainlinkOracle = AggregatorV3Interface(quoteAssetOracle);
        (uint80 roundId, int256 price, , uint256 timeStamp, ) = chainlinkOracle.getRoundData(id);
        require(price > 0, "Negative price");
        return (roundId, uint256(price), timeStamp);
    }

    function _getVAMMPriceById(uint80 id)
        internal
        view
        returns (
            uint80,
            uint256,
            uint256
        )
    {
        // get last price
        PerpetualTypes.Price memory poolPrice = prices[id];
        return (poolPrice.id, poolPrice.price, poolPrice.time);
    }

    /****************************** Funding Rate ******************************/
    function updateFundingRate() public onlyOwner {
        SignedMath.Int memory fundingRate = _getFundingRate();
        _setFundingRate(fundingRate);
        emit LogFundingPayment(block.number, fundingRate.value, fundingRate.isPositive);
    }

    function _getFundingRate() internal view returns (SignedMath.Int memory) {
        uint256 decimals = 10**8;
        uint256 priceIndex = getChainlinkTWAP(28800); // every 8 hours: 60x60x8=28800
        uint256 pricePerpetual = getPoolTWAP(28800);

        SignedMath.Int memory funding = SignedMath.Int({value: 0, isPositive: false});
        if (priceIndex >= pricePerpetual) {
            funding.isPositive = true;
            funding.value = ((priceIndex - pricePerpetual) * decimals) / (priceIndex * 24);
        } else {
            funding.isPositive = false;
            funding.value = ((pricePerpetual - priceIndex) * decimals) / (priceIndex * 24);
        }

        return funding;
    }

    // functions
    function _setFundingRate(SignedMath.Int memory fundingRate) internal {
        // load old funding rate
        PerpetualTypes.Index memory currentIndex = global_index;

        if (global_index.timeStamp < block.timestamp) {
            // convert to signed int
            SignedMath.Int memory currentIndexInt = SignedMath.Int({
                value: currentIndex.value,
                isPositive: currentIndex.isPositive
            });

            // new index values
            SignedMath.Int memory new_global_index = currentIndexInt.signedAdd(fundingRate);

            // update index
            global_index = PerpetualTypes.Index({
                value: new_global_index.value,
                isPositive: new_global_index.isPositive,
                timeStamp: block.timestamp
            });
        }
    }

    /****************************** Helper ******************************/

    function pushSnapshot() public onlyOwner {
        PerpetualTypes.Price memory newPrice;
        if (prices.length > 0) {
            newPrice = PerpetualTypes.Price({
                price: pool.price,
                time: block.timestamp,
                id: prices[prices.length].id + 1
            });
        } else {
            newPrice = PerpetualTypes.Price({price: pool.price, time: block.timestamp, id: 0});
        }
        prices.push(newPrice);
        emit LogSnapshot(newPrice.time, newPrice.price, newPrice.id);
    }
}
