// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// libraries
import {PRBMathUD60x18} from "prb-math/contracts/PRBMathUD60x18.sol";
import {PRBMathSD59x18} from "prb-math/contracts/PRBMathSD59x18.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

/*
 * To be used if `b` decimals make `b` larger than what it would be otherwise.
 * Especially useful for fixed point numbers, i.e. a way to represent decimal
 * values without using decimals. E.g. 25e2 with 3 decimals represents 2.5%
 *
 * In our case, we get exchange rates with a 18 decimal precision
 * (Solidity doesn't support decimal values natively).
 * So if we have a EUR positions and want to get the equivalent USD amount
 * we have to do: EUR_position * EUR_USD / 1e18 else the value would be way too high.
 * To move from USD to EUR: (USD_position * 1e18) / EUR_USD else the value would
 * be way too low.
 *
 * In essence,
 * wadMul: a.mul(b).div(WAY)
 * wadDiv: a.mul(WAY).div(b)
 * where `WAY` represents the number of decimals
 */
library LibMath {
    uint256 public constant POSITIVE_INT256_MAX = uint256(type(int256).max);

    // safe casting
    function toInt256(uint256 x) internal pure returns (int256) {
        return SafeCast.toInt256(x);
    }

    function toUint256(int256 x) internal pure returns (uint256) {
        return SafeCast.toUint256(x);
    }

    // absolute value
    function abs(int256 x) internal pure returns (int256) {
        return PRBMathSD59x18.abs(x);
    }

    // wad division
    function wadDiv(int256 x, int256 y) internal pure returns (int256) {
        return PRBMathSD59x18.div(x, y);
    }

    // wad multiplication
    function wadMul(int256 x, int256 y) internal pure returns (int256) {
        return PRBMathSD59x18.mul(x, y);
    }

    // wad division
    function wadDiv(uint256 x, uint256 y) internal pure returns (uint256) {
        return PRBMathUD60x18.div(x, y);
    }

    // wad multiplication
    function wadMul(uint256 x, uint256 y) internal pure returns (uint256) {
        return PRBMathUD60x18.mul(x, y);
    }
}
