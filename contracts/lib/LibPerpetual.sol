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

    struct UserPosition {
        int256 openNotional; // vQuote
        int256 positionSize; // vBase
        int256 cumFundingRate;
        uint256 liquidityBalance;
        int256 profit; // TODO: can you remove this?
    }

    struct GlobalPosition {
        int256 cumTradePremium;
        uint128 timeOfLastTrade;
        int256 premium;
        int256 cumFundingRate;
    }
}
