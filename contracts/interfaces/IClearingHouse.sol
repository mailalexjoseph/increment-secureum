// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// interfaces
import {IPerpetual} from "./IPerpetual.sol";

// libraries
import {LibPerpetual} from "../lib/LibPerpetual.sol";

interface IClearingHouse {
    event MarketAdded(IPerpetual indexed perpetual, uint256 numPerpetuals);
    event Deposit(uint256 indexed idx, address indexed user, address indexed asset, uint256 amount);
    event Withdraw(uint256 indexed idx, address indexed user, address indexed asset, uint256 amount);
    event ExtendPosition(
        uint256 indexed idx,
        address indexed user,
        uint128 indexed timeStamp,
        LibPerpetual.Side direction,
        int256 addedOpenNotional,
        int256 addedPositionSize
    );
    event ReducePosition(
        uint256 indexed idx,
        address indexed user,
        uint128 indexed timeStamp,
        int256 reducedOpenNotional,
        int256 reducedPositionSize
    );
    event LiquidationCall(
        uint256 indexed idx,
        address indexed liquidatee,
        address indexed liquidator,
        uint128 timestamp,
        uint256 notional
    );
    event FundingPayment(uint256 indexed idx, uint256 indexed blockNumber, uint256 value, bool isPositive);
    event LiquidityProvided(
        uint256 indexed idx,
        address indexed liquidityProvider,
        address indexed asset,
        uint256 amount
    );
    event LiquidityRemoved(
        uint256 indexed idx,
        address indexed liquidityProvider,
        uint256 removedLiquidity,
        int256 vQuoteProceeds,
        int256 vBaseAmount,
        int256 profit,
        address indexed asset
    );
    event Log(string errorMessage);
}
