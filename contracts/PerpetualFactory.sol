// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

// interfaces
import {IPerpetualFactory} from "./interfaces/IPerpetualFactory.sol";
import {IncreOwnable} from "./utils/IncreOwnable.sol";

contract PerpetualFactory is IPerpetualFactory, IncreOwnable {
    constructor() IncreOwnable() {}

    function deployPerpetual() external {}
}
