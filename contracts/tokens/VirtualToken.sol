// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IncreOwnable} from "../utils/IncreOwnable.sol";

// interfaces
import {IPerpetual} from "../interfaces/IPerpetual.sol";
import {IVirtualToken} from "../interfaces/IVirtualToken.sol";

// toDO: Write optimized ERC20 implementation for trades
contract VirtualToken is IVirtualToken, ERC20, IncreOwnable {
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {}

    function mint(uint256 amount) external override onlyOwner {
        _mint(address(owner), amount);
    }

    function burn(uint256 amount) external override onlyOwner {
        _burn(address(owner), amount);
    }
}
