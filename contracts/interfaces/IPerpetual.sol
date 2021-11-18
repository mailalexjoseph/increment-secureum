// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
import {IVault} from "./IVault.sol";
import {LibPerpetual} from "../lib/LibPerpetual.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPerpetual {
    event Deposit(address indexed user, address indexed asset, uint256 amount);
    event Withdraw(address indexed user, address indexed asset, uint256 amount);
    event Settlement(address indexed user, uint128 indexed timeStamp, int256 amount);
    event OpenPosition(
        address indexed user,
        uint128 indexed timeStamp,
        LibPerpetual.Side direction,
        uint256 notional,
        uint256 amount
    );
    event ClosePosition(
        address indexed user,
        uint128 indexed timeStamp,
        LibPerpetual.Side direction,
        int256 notional,
        uint256 amount
    );
    event LiquidationCall(address indexed liquidatee, address indexed liquidator, uint128 timestamp, int256 notional);
    event FundingPayment(uint256 indexed blockNumber, uint256 value, bool isPositive);

    // buy/ sell functions
    //@audit flag
    function openPosition(uint256 amount, LibPerpetual.Side direction) external returns (uint256);

    function closePosition() external;

    // funding rate functions
    function getLatestPrice() external view returns (LibPerpetual.Price memory);

    function getPrice(uint256 period) external view returns (LibPerpetual.Price memory);

    function setPrice(LibPerpetual.Price memory newPrice) external;

    function getUserProfit(address account) external returns (int256);

    // integration functions

    function deposit(
        uint256 amount,
        IVault vault,
        IERC20 token
    ) external;

    function withdraw(
        uint256 amount,
        IVault vault,
        IERC20 token
    ) external;

    function getVault(address _account) external returns (IVault vault);

    // user position function
    function getUserPosition(address account) external view returns (LibPerpetual.TraderPosition memory);

    function getGlobalPosition() external view returns (LibPerpetual.GlobalPosition memory);

    function settle(address account) external;

    function marginRatio(address account) external view returns (int256);

    function marginIsValid(address account) external view returns (bool);
}
