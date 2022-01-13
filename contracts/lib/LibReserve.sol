// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// libraries
import {LibMath} from "./LibMath.sol";

library LibReserve {
    using LibMath for int256;
    using LibMath for uint256;

    uint256 public constant MAX_DECIMALS = 18;

    /**
     * @notice Converts a raw token amount to its WAD representation. Used for tokens
     * that don't have 18 decimal places
     */
    function tokenToWad(uint256 tokenDecimals, uint256 amount) internal pure returns (uint256) {
        require(tokenDecimals <= MAX_DECIMALS, "Max decimals exceeded");
        uint256 scaler = 10**(MAX_DECIMALS - tokenDecimals);
        return amount * scaler;
    }

    /**
     * @notice Converts a wad token amount to its raw representation.
     */
    function wadToToken(uint256 tokenDecimals, uint256 wadAmount) internal pure returns (uint256) {
        require(tokenDecimals <= MAX_DECIMALS, "Max decimals exceeded");
        uint256 scaler = 10**(MAX_DECIMALS - tokenDecimals);
        return wadAmount / scaler;
    }
}
