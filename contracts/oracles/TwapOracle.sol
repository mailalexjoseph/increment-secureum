// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {IChainlinkOracle} from "../interfaces/IChainlinkOracle.sol";
import {ICryptoSwap} from "../interfaces/ICryptoSwap.sol";

// libraries
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibMath} from "../lib//LibMath.sol";

import "hardhat/console.sol";

/*
 * TwapOracle is used to compute and return a time-weighted average of the currencies
 * associated with the vBase/vQuote pair (e.g. EUR/USD).
 *
 * This twap oracle is inspired by this twap article of Uniswap: https://docs.uniswap.org/protocol/V2/concepts/core-concepts/oracles
 * Implementation follows the logic of the Uniswap twap oracle: https://github.com/Uniswap/v2-periphery/blob/master/contracts/examples/ExampleOracleSimple.sol
 */
contract TwapOracle {
    using SafeCast for uint256;
    using SafeCast for int256;

    uint256 public constant PERIOD = 15 minutes;

    uint256 public blockTimestampLast;
    uint256 public blockTimestampAtBeginningOfPeriod;

    int256 public oracleCumulativeAmount;
    int256 public oracleCumulativeAmountAtBeginningOfPeriod;
    int256 public oracleTwap;

    int256 public marketCumulativeAmount;
    // slither-disable-next-line similar-names
    int256 public marketCumulativeAmountAtBeginningOfPeriod;
    int256 public marketTwap;

    IChainlinkOracle public immutable chainlinkOracle;
    ICryptoSwap public immutable cryptoSwap;

    constructor(IChainlinkOracle _chainlinkOracle, ICryptoSwap _cryptoSwap) {
        chainlinkOracle = _chainlinkOracle;
        cryptoSwap = _cryptoSwap;

        // can't access immutable variables in the constructor
        int256 lastChainlinkPrice = IChainlinkOracle(_chainlinkOracle).getIndexPrice();
        int256 lastMarketPrice = ICryptoSwap(_cryptoSwap).last_prices().toInt256();

        // initialize the oracle
        oracleTwap = lastChainlinkPrice;
        marketTwap = lastMarketPrice;

        blockTimestampLast = block.timestamp;
        blockTimestampAtBeginningOfPeriod = block.timestamp;
    }

    event TwapUpdated(uint256 timeStamp, int256 newOracleTwap, int256 newMarketTwap);

    function updateTwap() external {
        uint256 currentTime = block.timestamp;
        int256 timeElapsed = (currentTime - blockTimestampLast).toInt256();

        blockTimestampLast = currentTime;
        /*
            priceCumulative1 = priceCumulative0 + price1 * timeElapsed
        */

        // update cumulative chainlink price feed
        int256 latestChainlinkPrice = chainlinkOracle.getIndexPrice();
        oracleCumulativeAmount = oracleCumulativeAmount + latestChainlinkPrice * timeElapsed;

        // update cumulative market price feed
        int256 latestMarketPrice = cryptoSwap.last_prices().toInt256();
        marketCumulativeAmount = marketCumulativeAmount + latestMarketPrice * timeElapsed;

        uint256 timeElapsedSinceBeginningOfPeriod = block.timestamp - blockTimestampAtBeginningOfPeriod;

        // slither-disable-next-line timestamp
        if (timeElapsedSinceBeginningOfPeriod >= PERIOD) {
            /*
                TWAP = priceCumulative1 - priceCumulative0 / timeElapsed
            */

            console.log("update twap");
            // calculate chainlink twap
            oracleTwap =
                (oracleCumulativeAmount - oracleCumulativeAmountAtBeginningOfPeriod) /
                timeElapsedSinceBeginningOfPeriod.toInt256();

            // calculate market twap
            marketTwap =
                (marketCumulativeAmount - marketCumulativeAmountAtBeginningOfPeriod) /
                timeElapsedSinceBeginningOfPeriod.toInt256();

            // reset cumulative amount and timestamp
            oracleCumulativeAmountAtBeginningOfPeriod = oracleCumulativeAmount;
            marketCumulativeAmountAtBeginningOfPeriod = marketCumulativeAmount;
            blockTimestampAtBeginningOfPeriod = block.timestamp;

            emit TwapUpdated(block.timestamp, oracleTwap, marketTwap);
        }
    }

    function getOracleTwap() external view returns (int256) {
        return oracleTwap;
    }

    function getMarketTwap() external view returns (int256) {
        return marketTwap;
    }
}
