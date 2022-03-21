// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

interface ITwapOracle {
    /* ****************** */
    /*     Events         */
    /* ****************** */

    /// @notice Emitted when twap is updated
    /// @param newOracleTwap Latest oracle Time-weighted-average-price
    /// @param newMarketTwap Latest market Time-weighted-average-price
    event TwapUpdated(int256 newOracleTwap, int256 newMarketTwap);

    /* ****************** */
    /*     Viewer         */
    /* ****************** */

    function getOracleTwap() external view returns (int256);

    function getMarketTwap() external view returns (int256);

    /* ****************** */
    /*  State modifying   */
    /* ****************** */

    function updateTwapAndFundingRate() external;
}
