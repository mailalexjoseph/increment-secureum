// SPDX-License-Identifier: MIT

import {IVault} from "./IVault.sol";

pragma solidity 0.8.4;

// @dev: deposit uint and withdraw int
// @author: only allows one type of collateral

interface IVaultV0 is IVault {
    function getAssetValue(address account, address asset) external view returns (int256);
}
