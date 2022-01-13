// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// contract
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICryptoSwap} from "./ICryptoSwap.sol";

// interfaces
import {IVault} from "./IVault.sol";
import {ICryptoSwap} from "./ICryptoSwap.sol";
import {IOracle} from "./IOracle.sol";
import {IVirtualToken} from "./IVirtualToken.sol";

// libraries
import {LibPerpetual} from "../lib/LibPerpetual.sol";

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
    event LiquidationCall(address indexed liquidatee, address indexed liquidator, uint128 timestamp, uint256 notional);
    event FundingPayment(uint256 indexed blockNumber, uint256 value, bool isPositive);
    event LiquidityProvided(address indexed liquidityProvider, address indexed asset, uint256 amount);
    event LiquidityWithdrawn(address indexed liquidityProvider, address indexed asset, uint256 amount);

    function market() external view returns (ICryptoSwap);

    function oracle() external view returns (IOracle);

    function vBase() external view returns (IVirtualToken);

    function vQuote() external view returns (IVirtualToken);

    function vault() external view returns (IVault);

    // buy/ sell functions
    //@audit flag
    function openPosition(uint256 amount, LibPerpetual.Side direction) external returns (uint256);

    function closePosition() external;

    // funding rate functions
    function getLatestPrice() external view returns (LibPerpetual.Price memory);

    function getPrice(uint256 period) external view returns (LibPerpetual.Price memory);

    function setPrice(LibPerpetual.Price memory newPrice) external;

    // integration functions
    function deposit(uint256 amount, IERC20 token) external;

    function withdraw(uint256 amount, IERC20 token) external;

    // user position function
    function getUserPosition(address account) external view returns (LibPerpetual.TraderPosition memory);

    function getGlobalPosition() external view returns (LibPerpetual.GlobalPosition memory);

    function marginRatio(address account) external view returns (int256);

    function marginIsValid(address account) external view returns (bool);

    // liquidator provider functions
    function provideLiquidity(uint256 amount, IERC20 token) external returns (uint256, uint256);

    function withdrawLiquidity(uint256 amount, IERC20 token) external;
}
