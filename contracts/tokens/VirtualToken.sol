// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {BaseERC20} from "./BaseERC20.sol";
import {IncreOwnable} from "../utils/IncreOwnable.sol";

// interfaces
import {IPerpetual} from "../interfaces/IPerpetual.sol";
import {IVirtualToken} from "../interfaces/IVirtualToken.sol";

// toDO: Write optimized ERC20 implementation for trades
contract VirtualToken is IVirtualToken, BaseERC20, IncreOwnable {
    constructor(string memory _name, string memory _symbol) BaseERC20(_name, _symbol) {}

    function mint(uint256 amount) external override onlyOwner {
        _mint(address(owner), amount);
    }

    function burn(uint256 amount) external override onlyOwner {
        _burn(address(owner), amount);
    }
}
