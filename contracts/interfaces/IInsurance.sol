// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

// interfaces
import {IPerpetual} from "./IPerpetual.sol";

interface IInsurance {
    function settleDebt(uint256 amount, IPerpetual market) external;

    function withdrawRemainder(uint256 amount, IPerpetual market) external;
}
