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
 * Except that the weighting is done over the length of one PERIOD minimum, and that every 2 PERIODs the value of the
 * the cumulative amount used as a reference point against the current cumulative amount is reset with the value it
 * had 1 PERIOD ago - same thing for the reference timestamp value.
 */
contract TwapOracle {
    using SafeCast for uint256;
    using SafeCast for int256;

    uint256 public constant PERIOD = 15 minutes;

    struct Time {
        uint256 blockTimestampLast;
        uint256 blockTimestampAtBeginningOfPeriod;
    }
    struct Prices {
        int256 cumulativeAmount;
        int256 cumulativeAmountAtBeginningOfPeriod;
        int256 twap;
    }

    // time
    Time public time;

    // prices
    Prices public oraclePrice;
    Prices public marketPrice;

    IChainlinkOracle public immutable chainlinkOracle;
    ICryptoSwap public immutable cryptoSwap;

    constructor(IChainlinkOracle _chainlinkOracle, ICryptoSwap _cryptoSwap) {
        chainlinkOracle = _chainlinkOracle;
        cryptoSwap = _cryptoSwap;

        // can't access immutable variables in the constructor
        int256 lastChainlinkPrice = IChainlinkOracle(_chainlinkOracle).getIndexPrice();
        int256 lastMarketPrice = ICryptoSwap(_cryptoSwap).last_prices().toInt256();

        // set twap to market price
        oraclePrice = Prices({cumulativeAmount: 0, cumulativeAmountAtBeginningOfPeriod: 0, twap: lastChainlinkPrice});
        marketPrice = Prices({cumulativeAmount: 0, cumulativeAmountAtBeginningOfPeriod: 0, twap: lastMarketPrice});
        time = Time({blockTimestampLast: block.timestamp, blockTimestampAtBeginningOfPeriod: block.timestamp});

        //console.log("Current block timestamp: ", block.timestamp);
    }

    event TwapUpdated();

    function updateTwap() public {
        uint256 currentTime = block.timestamp;
        int256 timeElapsed = (currentTime - time.blockTimestampLast).toInt256();

        //console.log("Current block timestamp: ", block.timestamp);
        time.blockTimestampLast = currentTime;
        /*
            priceCumulative1 = priceCumulative0 + price1 * timeElapsed
        */

        // update cumulative chainlink price feed
        int256 latestChainlinkPrice = chainlinkOracle.getIndexPrice();
        oraclePrice.cumulativeAmount = oraclePrice.cumulativeAmount + latestChainlinkPrice * timeElapsed;

        // update cumulative market price feed
        int256 latestMarketPrice = cryptoSwap.last_prices().toInt256();
        marketPrice.cumulativeAmount = marketPrice.cumulativeAmount + latestMarketPrice * timeElapsed;

        //console.log("latestChainlinkPrice: ");
        //console.logInt(latestChainlinkPrice);

        console.log("timeElapsed: ");
        console.logInt(timeElapsed);

        //console.log("oraclePrice.cumulativeAmount: ");
        //console.logInt(oraclePrice.cumulativeAmount);

        uint256 timeElapsedSinceBeginningOfPeriod = block.timestamp - time.blockTimestampAtBeginningOfPeriod;

        console.log("timeElapsedSinceBeginningOfPeriod ");
        console.log(timeElapsedSinceBeginningOfPeriod);

        // slither-disable-next-line timestamp
        if (timeElapsedSinceBeginningOfPeriod >= PERIOD) {
            console.log("update twap & reset");
            /*
                TWAP = priceCumulative1 - priceCumulative0 / timeElapsed
            */

            //console.log("oraclePrice.cumulativeAmountAtBeginningOfPeriod: ");
            //console.logInt(oraclePrice.cumulativeAmountAtBeginningOfPeriod);

            // calculate chainlink twap
            oraclePrice.twap =
                (oraclePrice.cumulativeAmount - oraclePrice.cumulativeAmountAtBeginningOfPeriod) /
                timeElapsedSinceBeginningOfPeriod.toInt256();

            // calculate market twap
            marketPrice.twap =
                (marketPrice.cumulativeAmount - marketPrice.cumulativeAmountAtBeginningOfPeriod) /
                timeElapsedSinceBeginningOfPeriod.toInt256();

            //console.log("oraclePrice.twap: ");
            //console.logInt(oraclePrice.twap);

            // reset cumulative amount and timestamp
            oraclePrice.cumulativeAmountAtBeginningOfPeriod = oraclePrice.cumulativeAmount;
            marketPrice.cumulativeAmountAtBeginningOfPeriod = marketPrice.cumulativeAmount;
            time.blockTimestampAtBeginningOfPeriod = block.timestamp;

            emit TwapUpdated();
        }
    }

    function getOracleTwap() external view returns (int256) {
        return oraclePrice.twap;
    }

    function getMarketTwap() external view returns (int256) {
        return oraclePrice.twap;
    }
}
