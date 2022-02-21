// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MintableERC20 is ERC20 {
    uint8 public _decimals;

    constructor(
        uint256 initialSupply,
        string memory shortName,
        string memory longName,
        uint8 decimals_
    ) ERC20(shortName, longName) {
        _mint(msg.sender, initialSupply);
        _decimals = decimals_;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
