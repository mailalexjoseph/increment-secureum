// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// contracts
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// interfaces
import {ISafetyPool} from "./interfaces/ISafetyPool.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";

contract SafetyPool is ISafetyPool {
    IERC20 public incre;

    constructor(address _incre) {
        incre = IERC20(_incre);
    }

    function stakeIncre(uint256 _amount) external override {}

    function withdrawIncre(uint256 _amount) external override {}

    function auctionOffIncre(uint256 _amount, IPerpetual _market) external override {}
}
