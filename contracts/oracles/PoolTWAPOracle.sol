// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// interfaces
import {ICryptoSwap} from "../interfaces/ICryptoSwap.sol";

// libraries
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibMath} from "../lib//LibMath.sol";

/*
 * PoolTWAP is used to compute and return a time-weighted average of the vBase/vQuote ratio in the crypto swap pool.
 *
 * This TWAP oracle is inspired by this TWAP article of Uniswap: https://docs.uniswap.org/protocol/V2/concepts/core-concepts/oracles
 * Except that the weighting is done over the length of one PERIOD minimum, and that every 2 PERIODs the value of the
 * the cumulative amount used as a reference point against the current cumulative amount is reset with the value it
 * had 1 PERIOD ago - same thing for the reference timestamp value.
 */
contract PoolTWAPOracle {
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

    ICryptoSwap public immutable pool;

    event TWAPUpdated();

    constructor(ICryptoSwap _curvePool) {
        pool = _curvePool;
    }

    function updateEURUSDTWAP() external {
        uint256 currentTime = block.timestamp;

        uint256 timeElapsed = currentTime - timeOfCumulativeAmount;
        // uint256 newPrice = LibMath.wadDiv(pool.balances(VBASE_INDEX), pool.balances(VQUOTE_INDEX));
        uint256 newPrice = pool.last_prices();

        cumulativeAmount = cumulativeAmount + LibMath.wadMul(newPrice, timeElapsed);
        timeOfCumulativeAmount = currentTime;

        uint256 timeElapsedSinceBeginningOfTWAPPeriodTmp = currentTime - timeOfCumulativeAmountAtBeginningOfPeriodTmp;
        // slither-disable-next-line timestamp
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
