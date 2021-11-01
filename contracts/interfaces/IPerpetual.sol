// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
import {IVault} from "./IVault.sol";
import {LibPerpetual} from "../lib/LibPerpetual.sol";

interface IPerpetual {
    // buy/ sell functions
    //@audit flag
    function mintLongPosition(uint256 amount) external view returns (uint256);

    function redeemLongPosition(uint256 amount) external view returns (uint256);

    function mintShortPosition(uint256 amount) external view returns (uint256);

    function redeemShortPosition(uint256 amount) external view returns (uint256);

    // funding rate functions
    function getLatestPrice() external view returns (LibPerpetual.Price memory);

    function getPrice(uint256 period) external view returns (LibPerpetual.Price memory);

    function setPrice(LibPerpetual.Price memory newPrice) external;

    // integration functions
    function setVault(address account, IVault vault) external;

    function getVault(address _account) external returns (IVault vault);

    // user position function
    function getUserPosition(address account) external view returns (LibPerpetual.TraderPosition memory);

    function getGlobalPosition() external view returns (LibPerpetual.GlobalPosition memory);

    function settle(address account) external;

    function marginIsValid(address account) external view returns (bool);
}
