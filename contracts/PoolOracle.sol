// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";

// libraries
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {LibMath} from "./lib/LibMath.sol";

// TMP
import "hardhat/console.sol";

// should it be made a library?
contract PoolOracle {
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

    ICryptoSwap public immutable pool;

    event TWAPUpdated();

    constructor(ICryptoSwap _curvePool) {
        pool = _curvePool;
    }

    function updateTWAP() external {
        uint256 currentTime = block.timestamp;

        uint256 timeElapsed = currentTime - timeOfCumulativeAmount;
        uint256 newPrice = LibMath.wadDiv(pool.balances(VBASE_INDEX), pool.balances(VQUOTE_INDEX));
        // console.log("newPrice: ", newPrice);
        // console.log("timeElapsed: ", timeElapsed);
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
    }

    function getTWAP() external view returns (int256) {
        // console.log("cumulativeAmount:", cumulativeAmount);
        // console.log("timeOfCumulativeAmount:", timeOfCumulativeAmount);
        // console.log("cumulativeAmountAtBeginningOfPeriod:", cumulativeAmountAtBeginningOfPeriod);
        // console.log("timeOfCumulativeAmountAtBeginningOfPeriod:", timeOfCumulativeAmountAtBeginningOfPeriod);
        // console.log("cumulativeAmountAtBeginningOfPeriodTmp:", cumulativeAmountAtBeginningOfPeriodTmp);
        // console.log("timeOfCumulativeAmountAtBeginningOfPeriodTmp:", timeOfCumulativeAmountAtBeginningOfPeriodTmp);

        int256 priceDiff = cumulativeAmount.toInt256() - cumulativeAmountAtBeginningOfPeriod.toInt256();
        int256 timeDiff = timeOfCumulativeAmount.toInt256() - timeOfCumulativeAmountAtBeginningOfPeriod.toInt256();

        // console.log("priceDiff:");
        // console.logInt(priceDiff);
        // console.log("timeDiff:");
        // console.logInt(timeDiff);

        if (timeDiff > 0) {
            return LibMath.wadDiv(priceDiff, timeDiff);
        }

        return 0;
    }
}
