// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {IncreOwnable} from "../utils/IncreOwnable.sol";

contract USDCmock is ERC20, IncreOwnable {
    uint8 public _decimals;

    constructor(
        string memory shortName,
        string memory longName,
        uint8 decimals_
    ) ERC20(shortName, longName) {
        _decimals = decimals_;
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
