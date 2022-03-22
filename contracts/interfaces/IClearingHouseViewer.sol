// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// interfaces
import {IClearingHouse} from "./IClearingHouse.sol";
import {IPerpetual} from "./IPerpetual.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVault} from "./IVault.sol";
import {ICryptoSwap} from "./ICryptoSwap.sol";
import {IInsurance} from "./IInsurance.sol";

// libraries
import {LibPerpetual} from "../lib/LibPerpetual.sol";

interface IClearingHouseViewer {
    // global getter
    function getExpectedVBaseAmount(uint256 idx, uint256 vQuoteAmountToSpend) external view returns (uint256);

    function getExpectedVQuoteAmount(uint256 idx, uint256 vBaseAmountToSpend) external view returns (uint256);

    function marketPrice(uint256 idx) external view returns (uint256);

    function indexPrice(uint256 idx) external view returns (int256);

    function getGlobalPosition(uint256 idx) external view returns (LibPerpetual.GlobalPosition memory);

    // user getter
    function getTraderPosition(uint256 idx, address account) external view returns (LibPerpetual.UserPosition memory);

    function getLpPosition(uint256 idx, address account) external view returns (LibPerpetual.UserPosition memory);

    function getTraderReserveValue(uint256 idx, address account) external view returns (int256);

    function getLpReserveValue(uint256 idx, address account) external view returns (int256);

    function getFundingPayments(uint256 idx, address account) external view returns (int256 upcomingFundingPayment);

    function getUnrealizedPnL(uint256 idx, address account) external view returns (int256);

    function getProposedAmount(
        uint256 idx,
        address trader,
        uint256 iter
    ) external view returns (uint256 amountIn, uint256 amountOut);
}
