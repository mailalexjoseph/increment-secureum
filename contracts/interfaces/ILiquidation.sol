// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {IPerpetual} from "./IPerpetual.sol";

interface ILiquidation {
    function liquidate(address account, IPerpetual market) external;

    function whiteListPerpetualMarket(IPerpetual perpetualMarket) external;
}
