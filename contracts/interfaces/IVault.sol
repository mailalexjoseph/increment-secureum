// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IChainlinkOracle} from "./IChainlinkOracle.sol";
import {IPerpetual} from "./IPerpetual.sol";

// @dev: deposit uint and withdraw int
// @author: The interface used in other contracts
interface IVault {
    event MarketAdded(IPerpetual market);

    function chainlinkOracle() external view returns (IChainlinkOracle);

    function reserveToken() external view returns (IERC20);

    function totalReserveToken() external view returns (uint256);

    function deposit(
        address user,
        uint256 amount,
        IERC20 token
    ) external returns (uint256);

    function withdrawAll(address user, IERC20 withdrawToken) external returns (uint256);

    function withdraw(
        address user,
        uint256 amount,
        IERC20 token
    ) external returns (uint256);

    function getReserveValue(address account, IPerpetual market) external view returns (int256);

    function getReserveTokenDecimals() external view returns (uint256);

    function settleProfit(address user, int256 amount) external;

    function getBalance(address user, IPerpetual market) external view returns (int256);

    function isAllowListed(IPerpetual market) external view returns (bool);

    function addMarket(IPerpetual market) external;
}
