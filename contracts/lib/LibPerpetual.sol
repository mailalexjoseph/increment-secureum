// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// libraries
import {LibMath} from "./LibMath.sol";

library LibPerpetual {
    using LibMath for int256;
    using LibMath for uint256;

    enum Side {
        Long,
        Short
    }

    struct UserPosition {
        int256 openNotional; // vQuote
        int256 positionSize; // vBase
        int256 cumFundingRate;
        uint256 liquidityBalance; // LP token amount (traders don't use it)
    }

    struct GlobalPosition {
        uint128 timeOfLastTrade;
        int256 cumFundingRate;
    }
}
