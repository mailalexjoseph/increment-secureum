// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
import {IVault} from "./IVault.sol";
import {LibPerpetual} from "../lib/LibPerpetual.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPerpetual {
    // buy/ sell functions
    //@audit flag
    function openLongPosition(uint256 amount) external returns (uint256);

    function closeLongPosition(uint256 amount) external returns (uint256);

    function openShortPosition(uint256 amount) external returns (uint256);

    function closeShortPosition(uint256 amount) external returns (uint256);

    // funding rate functions
    function getLatestPrice() external view returns (LibPerpetual.Price memory);

    function getPrice(uint256 period) external view returns (LibPerpetual.Price memory);

    function setPrice(LibPerpetual.Price memory newPrice) external;

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

    function marginIsValid(address account) external view returns (bool);
}
