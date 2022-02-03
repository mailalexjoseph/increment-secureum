// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {IChainlinkOracle} from "../interfaces/IChainlinkOracle.sol";

// libraries
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibMath} from "../lib//LibMath.sol";

/*
 * ChainlinkTWAPOracle is used to compute and return a time-weighted average of the currencies
 * associated with the vBase/vQuote pair (e.g. EUR/USD).
 *
 * This TWAP oracle is inspired by this TWAP article of Uniswap: https://docs.uniswap.org/protocol/V2/concepts/core-concepts/oracles
 * Except that the weighting is done over the length of one PERIOD minimum, and that every 2 PERIODs the value of the
 * the cumulative amount used as a reference point against the current cumulative amount is reset with the value it
 * had 1 PERIOD ago - same thing for the reference timestamp value.
 */
contract ChainlinkTWAPOracle {
    using SafeCast for uint256;
    using SafeCast for int256;

    uint256 public constant PERIOD = 15 minutes;
    uint256 public constant VQUOTE_INDEX = 0;
    uint256 public constant VBASE_INDEX = 1;

    uint256 public cumulativeAmount;
    uint256 public timeOfCumulativeAmount;
    uint256 public cumulativeAmountAtBeginningOfPeriod;
    uint256 public timeOfCumulativeAmountAtBeginningOfPeriod;
    uint256 public cumulativeAmountAtBeginningOfPeriodTmp;
    uint256 public timeOfCumulativeAmountAtBeginningOfPeriodTmp;

    int256 public currentEURUSDTWAP;

    IChainlinkOracle public immutable chainlinkOracle;

    event TWAPUpdated();

    constructor(IChainlinkOracle _chainlinkOracle) {
        chainlinkOracle = _chainlinkOracle;
    }

    function updateEURUSDTWAP() external {
        uint256 currentTime = block.timestamp;

        uint256 timeElapsed = currentTime - timeOfCumulativeAmount;
        uint256 newPrice = chainlinkOracle.getIndexPrice().toUint256();
        cumulativeAmount = cumulativeAmount + LibMath.wadMul(newPrice, timeElapsed);
        timeOfCumulativeAmount = currentTime;

        uint256 timeElapsedSinceBeginningOfTWAPPeriodTmp = currentTime - timeOfCumulativeAmountAtBeginningOfPeriodTmp;
        if (timeElapsedSinceBeginningOfTWAPPeriodTmp >= PERIOD) {
            cumulativeAmountAtBeginningOfPeriod = cumulativeAmountAtBeginningOfPeriodTmp;
            timeOfCumulativeAmountAtBeginningOfPeriod = timeOfCumulativeAmountAtBeginningOfPeriodTmp;

            cumulativeAmountAtBeginningOfPeriodTmp = cumulativeAmount;
            timeOfCumulativeAmountAtBeginningOfPeriodTmp = timeOfCumulativeAmount;

            emit TWAPUpdated();
        }

        int256 priceDiff = cumulativeAmount.toInt256() - cumulativeAmountAtBeginningOfPeriod.toInt256();
        int256 timeDiff = timeOfCumulativeAmount.toInt256() - timeOfCumulativeAmountAtBeginningOfPeriod.toInt256();

        currentEURUSDTWAP = LibMath.wadDiv(priceDiff, timeDiff);
    }

    function getEURUSDTWAP() external view returns (int256) {
        return currentEURUSDTWAP;
    }
}
