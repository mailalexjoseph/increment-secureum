// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// interfaces
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IInsurance} from "./IInsurance.sol";
import {IClearingHouse} from "./IClearingHouse.sol";

// @dev: deposit uint and withdraw int
// @author: The interface used in other contracts
interface IVault {
    // Event
    event BadDebtGenerated(uint256 idx, address beneficiary, uint256 amount);

    event ClearingHouseChanged(IClearingHouse newClearingHouse);

    event InsuranceChanged(IInsurance newInsurance);

    event MaxTVLChanged(uint256 newMaxTVL);

    event ValueLockedChanged(uint256 totalValueLocked);

    // dependencies
    function reserveToken() external view returns (IERC20);

    function insurance() external view returns (IInsurance);

    function clearingHouse() external view returns (IClearingHouse);

    // state modifying functions
    function deposit(
        uint256 idx,
        address user,
        uint256 amount,
        IERC20 token,
        bool isTrader
    ) external returns (uint256);

    function settleProfit(
        uint256 idx,
        address user,
        int256 amount,
        bool isTrader
    ) external;

    function withdraw(
        uint256 idx,
        address user,
        uint256 amount,
        IERC20 token,
        bool isTrader
    ) external returns (uint256);

    function withdrawPartial(
        uint256 idx,
        address user,
        IERC20 withdrawToken,
        uint256 reductionRatio,
        bool isTrader
    ) external returns (uint256);

    function withdrawAll(
        uint256 idx,
        address user,
        IERC20 withdrawToken,
        bool isTrader
    ) external returns (uint256);

    // system wide viewer functions
    function getReserveTokenDecimals() external view returns (uint256);

    function getTotalReserveToken() external view returns (uint256);

    function getBadDebt() external view returns (uint256);

    function getMaxTVL() external view returns (uint256);

    // user viewer functions
    function getLpReserveValue(uint256 idx, address account) external view returns (int256);

    function getTraderReserveValue(uint256 idx, address account) external view returns (int256);

    function getTraderBalance(uint256 idx, address account) external view returns (int256);

    function getLpBalance(uint256 idx, address account) external view returns (int256);
}
