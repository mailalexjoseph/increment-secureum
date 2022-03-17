// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

interface ITwapOracle {
    // events
    event TwapUpdated(int256 newOracleTwap, int256 newMarketTwap);

    // state changing functions

    function updateTwapAndFundingRate() external;

    // getter

    function getOracleTwap() external view returns (int256);

    function getMarketTwap() external view returns (int256);
}
