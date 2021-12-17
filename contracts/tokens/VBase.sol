// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// contracts
import {VirtualToken} from "./VirtualToken.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev VBase must be called right after Perpetual is deployed to set Perpetual as the owner of the contract
contract VBase is VirtualToken {
    constructor(string memory _name, string memory _symbol) VirtualToken(_name, _symbol) {}
}
