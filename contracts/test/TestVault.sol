// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {Vault} from "../Vault.sol";

// interfaces
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/*
 * TestVault includes some setter functions to edit part of
 * the internal state of Vault which aren't exposed otherwise.
 */
contract TestVault is Vault {
    constructor(IERC20 _reserveToken) Vault(_reserveToken) {}

    function __TestVault_set_trader_balance(
        uint256 idx,
        address user,
        int256 amount
    ) external {
        return _changeBalance(idx, user, amount, true);
    }
}
