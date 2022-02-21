// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// interfaces
import {IPerpetual} from "./IPerpetual.sol";

// libraries
import {LibPerpetual} from "../lib/LibPerpetual.sol";

interface IClearingHouse {
    event Deposit(uint256 idx, address indexed user, address indexed asset, uint256 amount);
    event Withdraw(uint256 idx, address indexed user, address indexed asset, uint256 amount);
    event Settlement(uint256 idx, address indexed user, int256 amount);
    event OpenPosition(
        uint256 idx,
        address indexed user,
        uint128 indexed timeStamp,
        LibPerpetual.Side direction,
        int256 notional,
        int256 amount
    );
    event ClosePosition(
        uint256 idx,
        address indexed user,
        uint128 indexed timeStamp,
        LibPerpetual.Side direction,
        int256 notional,
        int256 amount
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
