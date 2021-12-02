// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

// dependencies
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// toDO: Write optimized ERC20 implementation for trades
contract TradeToken is ERC20 {
    address public market;

    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}
}
