// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";

// libraries
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// should it be made a library?
contract PoolOracle {
    using SafeCast for uint256;
    using SafeCast for int256;

    uint256 public constant PERIOD = 1 hours;
    uint256 public constant VQUOTE_INDEX = 0;
    uint256 public constant VBASE_INDEX = 1;

    ICryptoSwap public pool;
    uint256 timeOfPreviousCumulativePriceOne;
    uint256 cumulativePriceOne;
    uint256 timeOfPreviousCumulativePriceTwo;
    uint256 cumulativePriceTwo;

    constructor(ICryptoSwap _curvePool) {
        pool = _curvePool;
    }

    // no update if TWAP is under PERIOD
    function updateTWAP() external {
        uint256 currentTime = block.timestamp;
        uint256 timeElapsed = currentTime - timeOfPreviousCumulativePriceTwo;

        if (timeElapsed >= PERIOD) {
            uint256 newPrice = pool.balances(VBASE_INDEX) / pool.balances(VQUOTE_INDEX);

            timeOfPreviousCumulativePriceOne = timeOfPreviousCumulativePriceTwo;
            cumulativePriceOne = cumulativePriceTwo;

            timeOfPreviousCumulativePriceTwo = currentTime;
            cumulativePriceTwo = cumulativePriceOne + newPrice * timeElapsed;
        }
    }

    function getTWAP() external view returns (int256) {
        int256 priceDiff = cumulativePriceTwo.toInt256() - cumulativePriceOne.toInt256();
        int256 timeDiff = timeOfPreviousCumulativePriceTwo.toInt256() - timeOfPreviousCumulativePriceOne.toInt256();

        return priceDiff / timeDiff;
    }
}
