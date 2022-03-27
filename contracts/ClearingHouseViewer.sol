// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

// interfaces
import {IClearingHouse} from "./interfaces/IClearingHouse.sol";
import {IClearingHouseViewer} from "./interfaces/IClearingHouseViewer.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// libraries
import {LibMath} from "./lib/LibMath.sol";
import {LibPerpetual} from "./lib/LibPerpetual.sol";

import "hardhat/console.sol";

/// @title Clearing House Helper Contract
/// @notice Access vault / perpetual / market getters through this contract
contract ClearingHouseViewer is IClearingHouseViewer {
    using SafeCast for uint256;
    using SafeCast for int256;
    using LibMath for uint256;
    using SafeERC20 for IERC20;

    // dependencies
    IClearingHouse public clearingHouse;

    uint256 private constant VQUOTE_INDEX = 0;
    uint256 private constant VBASE_INDEX = 1;

    constructor(IClearingHouse _clearingHouse) {
        require(address(_clearingHouse) != address(0), "ClearingHouse address cannot be 0");
        clearingHouse = _clearingHouse;
    }

    /// @notice Return amount for vBase one would receive for exchanging `vQuoteAmountToSpend` in a select market (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `extendPosition`
    /// @dev TODO: store market address to avoid second call
    /// @param idx Index of the perpetual market
    /// @param vQuoteAmountToSpend Amount of vQuote to be exchanged against some vBase. 18 decimals
    function getExpectedVBaseAmount(uint256 idx, uint256 vQuoteAmountToSpend) public view override returns (uint256) {
        return clearingHouse.perpetuals(idx).market().get_dy(VQUOTE_INDEX, VBASE_INDEX, vQuoteAmountToSpend);
    }

    /// @notice Return amount for vQuote one would receive for exchanging `vBaseAmountToSpend` in a select market (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `extendPosition`
    /// @dev TODO: store market address to avoid second call
    /// @param idx Index of the perpetual market
    /// @param vBaseAmountToSpend Amount of vBase to be exchanged against some vQuote. 18 decimals
    function getExpectedVQuoteAmount(uint256 idx, uint256 vBaseAmountToSpend) public view override returns (uint256) {
        return clearingHouse.perpetuals(idx).market().get_dy(VBASE_INDEX, VQUOTE_INDEX, vBaseAmountToSpend);
    }

    /// @notice Return the last traded price (used for TWAP)
    /// @param idx Index of the perpetual market
    function marketPrice(uint256 idx) public view override returns (uint256) {
        return clearingHouse.perpetuals(idx).marketPrice();
    }

    /// @notice Return the current off-chain exchange rate for vBase/vQuote
    /// @param idx Index of the perpetual market
    function indexPrice(uint256 idx) external view override returns (int256) {
        return clearingHouse.perpetuals(idx).indexPrice();
    }

    /// @param idx Index of the perpetual market
    function getGlobalPosition(uint256 idx) external view override returns (LibPerpetual.GlobalPosition memory) {
        return clearingHouse.perpetuals(idx).getGlobalPosition();
    }

    /* ****************** */
    /*   User viewer      */
    /* ****************** */

    /// @notice Calculate missed funding payments
    /// @param idx Index of the perpetual market
    /// @param account Trader to get the funding payments
    function getFundingPayments(uint256 idx, address account)
        external
        view
        override
        returns (int256 upcomingFundingPayment)
    {
        return clearingHouse.perpetuals(idx).getFundingPayments(account);
    }

    /// @param idx Index of the perpetual market
    /// @param account Trader to get the unrealized PnL from
    function getUnrealizedPnL(uint256 idx, address account) external view override returns (int256) {
        return clearingHouse.perpetuals(idx).getUnrealizedPnL(account);
    }

    /// @notice Get the portfolio value of a trader
    /// @param idx Index of the perpetual market
    /// @param account Address to get the portfolio value from
    function getTraderReserveValue(uint256 idx, address account) external view override returns (int256) {
        return clearingHouse.vault().getTraderReserveValue(idx, account);
    }

    /// @notice Get the portfolio value of an Lp
    /// @param idx Index of the perpetual market
    /// @param account Address to get the portfolio value from
    function getLpReserveValue(uint256 idx, address account) external view override returns (int256) {
        return clearingHouse.vault().getLpReserveValue(idx, account);
    }

    /// @notice Get trader position
    /// @param idx Index of the perpetual market
    /// @param account Address to get the trading position from
    function getTraderPosition(uint256 idx, address account)
        public
        view
        override
        returns (LibPerpetual.UserPosition memory)
    {
        return clearingHouse.perpetuals(idx).getTraderPosition(account);
    }

    /// @notice Get Lp position
    /// @param idx Index of the perpetual market
    /// @param account Address to get the LP position from
    function getLpPosition(uint256 idx, address account)
        external
        view
        override
        returns (LibPerpetual.UserPosition memory)
    {
        return clearingHouse.perpetuals(idx).getLpPosition(account);
    }

    /// @notice Get the current (base) dust balance
    /// @return Base balance of Governance (1e18)
    function getBaseDust(uint256 idx) external view override returns (uint256) {
        return clearingHouse.perpetuals(idx).getTraderPosition(address(clearingHouse)).positionSize.toUint256();
    }

    /// @notice Get the proposed amount needed to close a position
    /// @dev Solidity implementation to minimize the node calls once has to make when finding proposed amount
    /// @param idx Index of the perpetual market
    /// @param trader Account
    /// @param iter Maximum iterations
    function getProposedAmount(
        uint256 idx,
        address trader,
        uint256 iter
    ) external view override returns (uint256 amountIn, uint256 amountOut) {
        int256 positionSize = getTraderPosition(idx, trader).positionSize;
        if (positionSize > 0) {
            amountIn = uint256(positionSize);
            amountOut = getExpectedVQuoteAmount(idx, amountIn);
        } else {
            uint256 position = uint256(-positionSize);
            amountOut = 0;
            amountIn = position.wadMul(marketPrice(idx));
            // binary search in [marketPrice * 0.7, marketPrice * 1.3]
            uint256 maxVal = (amountIn * 13) / 10;
            uint256 minVal = (amountIn * 7) / 10;

            for (uint256 i = 0; i < iter; i++) {
                amountIn = (minVal + maxVal) / 2;
                // slither-disable-next-line calls-loop
                amountOut = getExpectedVBaseAmount(idx, amountIn);

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
                amountOut = getExpectedVBaseAmount(idx, amountIn);
            }
            return (amountIn, amountOut);
        }
    }
}
