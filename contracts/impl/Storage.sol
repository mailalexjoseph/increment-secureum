// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {PTypes} from "../lib/PTypes.sol";
import {ILendingPoolAddressesProvider} from "../interfaces/Aave/lendingPool/ILendingPoolAddressesProvider.sol";

import "hardhat/console.sol";

/// @notice Stores all contract states

contract Storage {
    // vAMM trading pool
    PTypes.Pool public pool;

    // global index
    PTypes.Index public global_index;

    // user position
    mapping(address => PTypes.UserPosition) public balances;
    mapping(address => PTypes.Index) public index;

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
    PTypes.Price[] public prices;
    mapping(address => bool) public isSettledAccount;
}
