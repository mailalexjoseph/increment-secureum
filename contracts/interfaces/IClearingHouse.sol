// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// interfaces
import {IPerpetual} from "./IPerpetual.sol";

// libraries
import {LibPerpetual} from "../lib/LibPerpetual.sol";

interface IClearingHouse {
    event MarketAdded(IPerpetual indexed perpetual, uint256 numPerpetuals);
    event Deposit(uint256 idx, address indexed user, address indexed asset, uint256 amount);
    event Withdraw(uint256 idx, address indexed user, address indexed asset, uint256 amount);
    event ExtendPosition(
        uint256 idx,
        address indexed user,
        uint128 indexed timeStamp,
        LibPerpetual.Side direction,
        int256 addedOpenNotional,
        int256 addedPositionSize
    );
    event ReducePosition(
        uint256 idx,
        address indexed user,
        uint128 indexed timeStamp,
        int256 reducedOpenNotional,
        int256 reducedPositionSize
    );
    event LiquidationCall(
        uint256 idx,
        address indexed liquidatee,
        address indexed liquidator,
        uint128 timestamp,
        uint256 notional
    );
    event FundingPayment(uint256 idx, uint256 indexed blockNumber, uint256 value, bool isPositive);
    event LiquidityProvided(uint256 idx, address indexed liquidityProvider, address indexed asset, uint256 amount);
    event LiquidityRemoved(uint256 idx, address indexed liquidityProvider, uint256 amount);
    event LiquidityWithdrawn(uint256 idx, address indexed liquidityProvider);
    event Log(string errorMessage);
}
