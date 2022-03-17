// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// libraries
import {LibMath} from "./LibMath.sol";

library LibPerpetual {
    using LibMath for int256;
    using LibMath for uint256;

    enum Side {
        // long position
        Long,
        // short position
        Short
    }

    struct UserPosition {
        // quote assets / liabilities
        int256 openNotional;
        // base assets / liabilities
        int256 positionSize;
        // user cumulative funding rate (updated when open/close position)
        int256 cumFundingRate;
        // lp token owned (is zero for traders)
        uint256 liquidityBalance;
    }

    struct GlobalPosition {
        // timestamp of last trade
        uint128 timeOfLastTrade;
        // timestamp of last TWAP update
        uint128 timeOfLastTwapUpdate;
        // global cumulative funding rate (updated every trade)
        int256 cumFundingRate;
        // market price at the start of the block
        int256 blockStartPrice;
    }
}
