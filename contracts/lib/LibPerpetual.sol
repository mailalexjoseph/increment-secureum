// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// libraries
import {LibMath} from "./LibMath.sol";

library LibPerpetual {
    using LibMath for int256;
    using LibMath for uint256;

    struct Price {
        uint128 roundId;
        uint128 timeStamp;
        int256 price;
    }

    enum Side {
        Long,
        Short
    }

    struct TraderPosition {
        uint256 notional; // amount spent in usdc converted to a 18 decimal amount to open the position (can include leverage)
        uint256 positionSize; // in vBase if side is Long or vQuote if side is Short
        int256 profit;
        Side side;
        uint128 timeStamp;
        int256 cumFundingRate;
    }

    struct GlobalPosition {
        int256 cumTradePremium;
        uint128 timeOfLastTrade;
        uint128 timeStamp;
        int256 premium;
        int256 cumFundingRate;
    }
}
