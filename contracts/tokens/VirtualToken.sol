// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {IPerpetual} from "../interfaces/IPerpetual.sol";
import {IVirtualToken} from "../interfaces/IVirtualToken.sol";

// dependencies
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// toDO: Write optimized ERC20 implementation for trades
contract VirtualToken is IVirtualToken, ERC20 {
    IPerpetual public immutable perpetual;

    modifier onlyPerpetual() {
        require(msg.sender == address(perpetual));
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        IPerpetual _perpetual
    ) ERC20(_name, _symbol) {
        perpetual = _perpetual;
    }

    function mint(uint256 amount) external override onlyPerpetual {
        _mint(address(perpetual), amount);
    }

    function burn(uint256 amount) external override onlyPerpetual {
        _burn(address(perpetual), amount);
    }
}
