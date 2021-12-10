// SPDX-License-Identifier: AGPL-3.0-or-later

pragma solidity 0.8.4;

// interfaces
import {IPerpetual} from "./IPerpetual.sol";

interface ISafetyPool {
    function stakeIncre(uint256 amount) external;

    function withdrawIncre(uint256 amount) external;

    function auctionOffIncre(uint256 amount, IPerpetual market) external;
}
