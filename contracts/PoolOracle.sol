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

    // no update if TWAP is under PERIOD
    function updateTWAP() external {
        uint256 currentTime = block.timestamp;
        console.log("currentTime:", currentTime);

        uint256 timeElapsed = currentTime - timeOfCumulativeAmount;
        // newPrice = pool.balances(VBASE_INDEX) / pool.balances(VQUOTE_INDEX);
        uint256 newPrice = LibMath.wadDiv(pool.balances(VBASE_INDEX), pool.balances(VQUOTE_INDEX));
        // cumulativeAmount = cumulativeAmount + newPrice * timeElapsed;
        cumulativeAmount = cumulativeAmount + LibMath.wadMul(newPrice, timeElapsed);
        timeOfCumulativeAmount = currentTime;

        uint256 timeElapsedSinceBeginningOfTWAPPeriodTmp = currentTime - timeOfCumulativeAmountAtBeginningOfPeriodTmp;
        if (timeElapsedSinceBeginningOfTWAPPeriodTmp >= PERIOD) {
            console.log("In new PERIOD block");

            cumulativeAmountAtBeginningOfPeriod = cumulativeAmountAtBeginningOfPeriodTmp;
            timeOfCumulativeAmountAtBeginningOfPeriod = timeOfCumulativeAmountAtBeginningOfPeriodTmp;

            cumulativeAmountAtBeginningOfPeriodTmp = cumulativeAmount;
            timeOfCumulativeAmountAtBeginningOfPeriodTmp = timeOfCumulativeAmount;

            emit TWAPUpdated();
        }
    }

    function getTWAP() external view returns (int256) {
        console.log("cumulativeAmount:", cumulativeAmount);
        console.log("timeOfCumulativeAmount:", timeOfCumulativeAmount);
        console.log("cumulativeAmountAtBeginningOfPeriod:", cumulativeAmountAtBeginningOfPeriod);
        console.log("timeOfCumulativeAmountAtBeginningOfPeriod:", timeOfCumulativeAmountAtBeginningOfPeriod);
        console.log("cumulativeAmountAtBeginningOfPeriodTmp:", cumulativeAmountAtBeginningOfPeriodTmp);
        console.log("timeOfCumulativeAmountAtBeginningOfPeriodTmp:", timeOfCumulativeAmountAtBeginningOfPeriodTmp);

        int256 priceDiff = cumulativeAmount.toInt256() - cumulativeAmountAtBeginningOfPeriod.toInt256();
        int256 timeDiff = timeOfCumulativeAmount.toInt256() - timeOfCumulativeAmountAtBeginningOfPeriod.toInt256();

        if (timeDiff > 0) {
            console.log("priceDiff:");
            console.logInt(priceDiff);
            console.log("timeDiff:");
            console.logInt(timeDiff);

            // priceDiff / timeDiff;
            return LibMath.wadDiv(priceDiff, timeDiff);
        }

        return 0;
    }
}
