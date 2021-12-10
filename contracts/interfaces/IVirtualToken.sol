// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {ICryptoSwap} from "../interfaces/ICryptoSwap.sol";
import {IPerpetual} from "../interfaces/IPerpetual.sol";

// dependencies
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVirtualToken is IERC20, IERC20Metadata {
    function mint(uint256 amount) external;

    function burn(uint256 amount) external;
}
