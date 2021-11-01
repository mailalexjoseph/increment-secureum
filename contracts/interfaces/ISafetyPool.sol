// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {IPerpetual} from "./IPerpetual.sol";

interface ISafetyPool {
    function stakeIncre(uint256 amount) external;

    function withdrawIncre(uint256 amount) external;

    function auctionOffIncre(uint256 amount, IPerpetual market) external;
}
