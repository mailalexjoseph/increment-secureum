// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// interfaces
import {IClearingHouse} from "./interfaces/IClearingHouse.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// libraries
import {LibMath} from "./lib/LibMath.sol";

import "hardhat/console.sol";

contract ClearingHouseViewer {
    using SafeCast for uint256;
    using SafeCast for int256;
    using LibMath for uint256;
    using SafeERC20 for IERC20;

    // dependencies
    IClearingHouse public clearingHouse;

    constructor(IClearingHouse _clearingHouse) {
        require(address(_clearingHouse) != address(0), "ClearingHouse address cannot be 0");
        clearingHouse = _clearingHouse;
    }

    /// @dev used for testnet
    /// @param idx Index of the perpetual market
    /// @param trader Account
    /// @param iter Maximum iterations
    function getProposedAmount(
        uint256 idx,
        address trader,
        uint256 iter
    ) external view returns (uint256 amountIn, uint256 amountOut) {
        int256 positionSize = clearingHouse.getTraderPosition(idx, trader).positionSize;
        uint256 position = uint256(positionSize);
        if (positionSize > 0) {
            amountIn = position;
            amountOut = clearingHouse.getExpectedVQuoteAmount(idx, amountIn);
        } else {
            amountOut = 0;
            amountIn = position.wadMul(clearingHouse.marketPrice(idx));

            // binary search in [marketPrice * 0.7, marketPrice * 1.3]
            uint256 maxVal = (amountIn * 13) / 10;
            uint256 minVal = (amountIn * 7) / 10;

            for (uint256 i = 0; i < iter; i++) {
                amountIn = (minVal + maxVal) / 2;
                // slither-disable-next-line calls-loop
                amountOut = clearingHouse.getExpectedVBaseAmount(idx, amountIn);

                if (amountOut == position) {
                    break;
                } else if (amountOut < position) {
                    minVal = amountIn;
                } else {
                    maxVal = amountIn;
                }
            }

            // take maxVal to make sure we are above the target
            if (amountOut < position) {
                amountIn = maxVal;
                amountOut = clearingHouse.getExpectedVBaseAmount(idx, amountIn);
            }
            return (amountIn, amountOut);
        }
    }
}
