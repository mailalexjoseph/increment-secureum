// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import {IPerpetual} from "../IPerpetual.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @title A perpetual contract w/ aTokens as collateral
/// @author Markus Schick
/// @notice You can only buy one type of perpetual and only use USDC as reserve

contract PerpetualDataProvider {
    struct TokenData {
        string symbol;
        address tokenAddress;
    }

    IPerpetual public immutable perpetual;

    constructor(IPerpetual _perpetual) {
        perpetual = _perpetual;
    }

    function getAllReservesTokens() external view returns (TokenData[] memory) {
        address[] memory reserves = perpetual.getReserveAssets();
        TokenData[] memory reservesTokens = new TokenData[](reserves.length);
        for (uint256 i = 0; i < reserves.length; i++) {
            reservesTokens[i] = TokenData({symbol: IERC20Metadata(reserves[i]).symbol(), tokenAddress: reserves[i]});
        }
        return reservesTokens;
    }
}
