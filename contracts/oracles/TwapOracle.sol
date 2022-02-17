// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {IChainlinkOracle} from "../interfaces/IChainlinkOracle.sol";
import {ICryptoSwap} from "../interfaces/ICryptoSwap.sol";

// libraries
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibMath} from "../lib//LibMath.sol";

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
        uint256 timeOfCumulativeAmount;
        uint256 timeOfCumulativeAmountAtBeginningOfPeriod;
    }

    struct Prices {
        uint256 cumulativeAmount;
        uint256 cumulativeAmountAtBeginningOfPeriod;
        int256 twap;
    }

    Time public time;
    Prices public oraclePrice;
    Prices public marketPrice;

    IChainlinkOracle public immutable chainlinkOracle;
    ICryptoSwap public immutable pool;

    constructor(IChainlinkOracle _chainlinkOracle, ICryptoSwap _curvePool) {
        chainlinkOracle = _chainlinkOracle;
        pool = _curvePool;
    }

    event TwapUpdated();

    function updateCurveTwap() public {
        _updateSingleTwap(pool.price_oracle(), marketPrice);
        emit TwapUpdated();
    }

    function updateChainlinkTwap() public {
        _updateSingleTwap(chainlinkOracle.getIndexPrice().toUint256(), oraclePrice);
        emit TwapUpdated();
    }

    function _updateSingleTwap(uint256 latestPrice, Prices storage price) internal {
        uint256 currentTime = block.timestamp;

        uint256 timeElapsed = currentTime - time.timeOfCumulativeAmount;
        price.cumulativeAmount = price.cumulativeAmount + LibMath.wadMul(latestPrice, timeElapsed);
        time.timeOfCumulativeAmount = currentTime;

        uint256 timeElapsedSinceBeginningOfTwapPeriodTmp = currentTime - time.timeOfCumulativeAmountAtBeginningOfPeriod;

        // slither-disable-next-line timestamp
        if (timeElapsedSinceBeginningOfTwapPeriodTmp >= PERIOD) {
            price.cumulativeAmountAtBeginningOfPeriod = price.cumulativeAmount;
            time.timeOfCumulativeAmountAtBeginningOfPeriod = time.timeOfCumulativeAmount;
        }

        int256 priceDiff = price.cumulativeAmount.toInt256() - price.cumulativeAmountAtBeginningOfPeriod.toInt256();
        int256 timeDiff = time.timeOfCumulativeAmount.toInt256() -
            time.timeOfCumulativeAmountAtBeginningOfPeriod.toInt256();

        if (timeDiff > 0) {
            price.twap = LibMath.wadDiv(priceDiff, timeDiff);
        }
    }

    function getOracleTwap() external view returns (int256) {
        return oraclePrice.twap;
    }

    function getMarketTwap() external view returns (int256) {
        return oraclePrice.twap;
    }
}
