// SPDX-License-Identifier: AGPL-3.0-or-later

//SPDX-License-Identifier: MIT
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
        int256 notional;
        int256 positionSize;
        int256 profit;
        Side side;
        uint128 timeStamp;
        int256 cumFundingRate;
    }

    struct GlobalPosition {
        uint128 timeStamp;
        int256 cumFundingRate;
    }
}
