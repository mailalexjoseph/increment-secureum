// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";

// libraries
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// TMP
import "hardhat/console.sol";

// should it be made a library?
contract PoolOracle {
    using SafeCast for uint256;
    using SafeCast for int256;

    uint256 public constant PERIOD = 15 minutes;
    uint256 public constant VQUOTE_INDEX = 0;
    uint256 public constant VBASE_INDEX = 1;

    ICryptoSwap public immutable pool;
    uint256 public timeOfCumulativePriceOne;
    uint256 public cumulativePriceOne;
    uint256 public timeOfCumulativePriceTwo;
    uint256 public cumulativePriceTwo;

    event TWAPUpdated();

    constructor(ICryptoSwap _curvePool) {
        pool = _curvePool;
    }

    // no update if TWAP is under PERIOD
    function updateTWAP() external {
        uint256 currentTime = block.timestamp;
        uint256 timeElapsed = currentTime - timeOfCumulativePriceTwo;

        console.log("currentTime:", currentTime);

        if (timeElapsed >= PERIOD) {
            uint256 newPrice = pool.balances(VBASE_INDEX) / pool.balances(VQUOTE_INDEX);

            timeOfCumulativePriceOne = timeOfCumulativePriceTwo;
            cumulativePriceOne = cumulativePriceTwo;

            timeOfCumulativePriceTwo = currentTime;
            cumulativePriceTwo = cumulativePriceOne + newPrice * timeElapsed;

            emit TWAPUpdated();
        }
    }

    function getTWAP() external view returns (int256) {
        console.log("cumulativePriceOne:", cumulativePriceOne);
        console.log("timeOfCumulativePriceOne:", timeOfCumulativePriceOne);
        console.log("cumulativePriceTwo:", cumulativePriceTwo);
        console.log("timeOfCumulativePriceTwo:", timeOfCumulativePriceTwo);

        if (timeOfCumulativePriceTwo > 0) {
            int256 priceDiff = cumulativePriceTwo.toInt256() - cumulativePriceOne.toInt256();
            int256 timeDiff = timeOfCumulativePriceTwo.toInt256() - timeOfCumulativePriceOne.toInt256();

            console.log("priceDiff:");
            console.logInt(priceDiff);
            console.log("timeDiff:");
            console.logInt(timeDiff);

            return priceDiff / timeDiff;
        }

        return 0;
    }
}
