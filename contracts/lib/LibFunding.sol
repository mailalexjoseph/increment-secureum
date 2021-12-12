// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// dependencies
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// interfaces
import {IPerpetual} from "../interfaces/IPerpetual.sol";

// libraries
import {LibMath} from "./LibMath.sol";
import {LibPerpetual} from "./LibPerpetual.sol";

import "hardhat/console.sol";

// see: UniswapV3, Position Library
// /// @notice Returns the Info struct of a position, given an owner and position boundaries
// /// @param self The mapping containing all user positions
// /// @param owner The address of the position owner
// /// @param tickLower The lower tick boundary of the position
// /// @param tickUpper The upper tick boundary of the position
// /// @return position The position info struct of the given owners' position
// function get(
//     mapping(bytes32 => Info) storage self,
//     address owner,
//     int24 tickLower,
//     int24 tickUpper
// ) internal view returns (Position.Info storage position) {
//     position = self[keccak256(abi.encodePacked(owner, tickLower, tickUpper))];
// }

library LibFunding {
    using SafeCast for uint256;
    using SafeCast for int256;

    int256 constant SENSITIVITY = 10e18; // funding rate sensitivity to price deviations

    function calculateFunding(
        LibPerpetual.GlobalPosition storage global,
        int256 marketPrice,
        int256 indexPrice,
        uint256 currentTime,
        uint256 TWAP_FREQUENCY
    ) internal {
        int256 premium = (LibMath.div(marketPrice - indexPrice, indexPrice) * TWAP_FREQUENCY.toInt256()) / (1 days);

        // add to cumulative price if no block in trade yet
        global.cumTradeVolume += LibMath.mul(
            (currentTime - global.timeOfLastTrade).toInt256(),
            LibMath.mul(premium, SENSITIVITY)
        );

        // reset time
        global.timeOfLastTrade = currentTime.toUint128();

        uint256 lastFundingUpdate = uint256(global.timeStamp);
        uint256 nextFundingRateUpdate = lastFundingUpdate + TWAP_FREQUENCY;

        //  if funding rate should be updated
        if (currentTime >= nextFundingRateUpdate) {
            // get time since last funding rate update
            int256 timePassed = (currentTime - lastFundingUpdate).toInt256();

            // update new funding Rate if 15 minutes have passed
            global.cumFundingRate = LibMath.div(global.cumTradeVolume, timePassed);

            // reset time & volume
            global.timeStamp = currentTime.toUint128();
            global.cumTradeVolume = 0;
        }
    }
}
