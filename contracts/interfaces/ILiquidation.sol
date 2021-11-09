// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {IPerpetual} from "./IPerpetual.sol";

/// @author Log info about liquidaiton with two separate events (ony 3 parameters can be indexed)
interface ILiquidation {
    /// @notice Log market liquidation
    event LiquidationCall(
        address indexed market,
        address indexed liquidatee,
        address indexed liquidator,
        uint256 amount,
        uint256 timestamp
    );

    function liquidate(address account, IPerpetual market) external;

    function whiteListPerpetualMarket(IPerpetual perpetualMarket) external;
}
