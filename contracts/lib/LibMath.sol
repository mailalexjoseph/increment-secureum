// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// dependencies
import {PRBMathUD60x18} from "prb-math/contracts/PRBMathUD60x18.sol";
import {PRBMathSD59x18} from "prb-math/contracts/PRBMathSD59x18.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

library LibMath {
    uint256 public constant POSITIVE_INT256_MAX = uint256(type(int256).max);

    function toInt256(uint256 x) internal pure returns (int256) {
        return SafeCast.toInt256(x);
    }

    function toUint256(int256 x) internal pure returns (uint256) {
        return SafeCast.toUint256(x);
    }

    function div(int256 x, int256 y) internal pure returns (int256) {
        return PRBMathSD59x18.div(x, y);
    }

    function mul(int256 x, int256 y) internal pure returns (int256) {
        return PRBMathSD59x18.mul(x, y);
    }
}
