// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {ISafetyPool} from "./interfaces/ISafetyPool.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";

contract SafetyPool is ISafetyPool {
    function stakeIncre(uint256 _amount) external override {}

    function withdrawIncre(uint256 _amount) external override {}

    function auctionOffIncre(uint256 _amount, IPerpetual _market) external override {}
}
