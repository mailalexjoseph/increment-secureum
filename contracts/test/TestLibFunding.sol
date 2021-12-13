// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// libraries
import {LibFunding} from "../lib/LibFunding.sol";
import {LibPerpetual} from "../lib/LibPerpetual.sol";

import "hardhat/console.sol";

contract TestLibFunding {
    // initiate state
    LibPerpetual.GlobalPosition public globalPosition;

    // simplified setter
    function setGlobalPosition(
        int256 cumTradePremium,
        uint128 timeOfLastTrade,
        uint128 timeStamp,
        int256 premium,
        int256 cumFundingRate
    ) public {
        globalPosition = LibPerpetual.GlobalPosition({
            cumTradePremium: cumTradePremium,
            timeOfLastTrade: timeOfLastTrade,
            timeStamp: timeStamp,
            premium: premium,
            cumFundingRate: cumFundingRate
        });
    }

    // simplified getter
    function getGlobalPosition() public view returns (LibPerpetual.GlobalPosition memory) {
        return globalPosition;
    }

    // calculate the funding rate
    function calculateFunding(
        int256 marketPrice,
        int256 indexPrice,
        uint256 currentTime,
        uint256 TWAP_FREQUENCY
    ) public {
        LibFunding.calculateFunding(globalPosition, marketPrice, indexPrice, currentTime, TWAP_FREQUENCY);
    }
}
