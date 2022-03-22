// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// libraries
import {LibMath} from "./LibMath.sol";

library LibReserve {
    using LibMath for int256;
    using LibMath for uint256;

    uint256 internal constant MAX_DECIMALS = 18;

    /// @notice Convert amount from 'tokenDecimals' to 18 decimals precision
    /// @param tokenDecimals Decimals of the token
    /// @param tokenAmount Amount with tokenDecimals precision
    function tokenToWad(uint256 tokenDecimals, uint256 tokenAmount) internal pure returns (uint256) {
        require(tokenDecimals <= MAX_DECIMALS, "Max decimals exceeded");
        uint256 scaler = 10**(MAX_DECIMALS - tokenDecimals);
        return tokenAmount * scaler;
    }

    /// @notice Convert amount from 'tokenDecimals' decimals to 18 decimals precision
    /// @param tokenDecimals Decimals of the token
    /// @param wadAmount Amount with 18 decimals precision
    function wadToToken(uint256 tokenDecimals, uint256 wadAmount) internal pure returns (uint256) {
        require(tokenDecimals <= MAX_DECIMALS, "Max decimals exceeded");
        uint256 scaler = 10**(MAX_DECIMALS - tokenDecimals);
        return wadAmount / scaler;
    }
}
