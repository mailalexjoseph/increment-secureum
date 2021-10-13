// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {IPerpetual} from "./IPerpetual.sol";

interface ISafetyPool {
    function stakeIncre(uint256 _amount) external;

    function withdrawIncre(uint256 _amount) external;

    function auctionOffIncre(uint256 _amount, IPerpetual _market) external;
}
