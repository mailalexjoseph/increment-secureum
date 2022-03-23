// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

interface ITwapOracle {
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
