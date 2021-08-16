// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {PerpetualTypes} from "../lib/PerpetualTypes.sol";
import {ILendingPoolAddressesProvider} from "../interfaces/Aave/lendingPool/ILendingPoolAddressesProvider.sol";

import "hardhat/console.sol";

/// @notice Stores all contract states

contract Storage {
    // vAMM trading pool
    PerpetualTypes.Pool public pool;

    // global index
    PerpetualTypes.Index public global_index;

    // user position
    mapping(address => PerpetualTypes.UserPosition) public balances;
    mapping(address => PerpetualTypes.Index) public index;

    // reserve assets
    address[] public _TOKENS_;

    // Aave integration
    ILendingPoolAddressesProvider lendingPoolAddressesProvider;
    mapping(address => address) aaveReserve;
    mapping(address => bool) isAaveToken;

    // oracles
    address public quoteAssetOracle;
    mapping(address => address) public assetOracles;

    // TWAP prices
    PerpetualTypes.Price[] public prices;
    mapping(address => bool) public isSettledAccount;
}
