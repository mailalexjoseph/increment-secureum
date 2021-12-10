// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {IInsurance} from "./interfaces/IInsurance.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";

contract Insurance is IInsurance {
    function settleDebt(uint256 _amount, IPerpetual _market) external override {}

    function withdrawRemainder(uint256 _amount, IPerpetual _market) external override {}
}
