// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {LibPerpetual} from "./lib/LibPerpetual.sol";

import {MockStableSwap} from "./mocks/MockStableSwap.sol";

contract Perpetual is IPerpetual {
    using SafeCast for uint256;
    using SafeCast for int256;
    event LogFundingPayment(uint256 indexed blockNumber, uint256 value, bool isPositive);

    MockStableSwap public market;

    constructor(uint256 _vQuote, uint256 _vBase) {
        market = new MockStableSwap(_vQuote, _vBase);
    }

    LibPerpetual.Price[] public prices;
    mapping(address => LibPerpetual.TraderPosition) userPosition;
    LibPerpetual.GlobalPosition public globalPosition;
    mapping(address => IVault) vaultUsed;
    mapping(IERC20 => IVault) tokenToVault;

    // viewer function
    function getLatestPrice() public view override returns (LibPerpetual.Price memory) {
        return getPrice(prices.length - 1);
    }

    function getPrice(uint256 period) public view override returns (LibPerpetual.Price memory) {
        return prices[period];
    }

    function getVault(address account) public override returns (IVault) {
        return vaultUsed[account];
    }

    function getUserPosition(address account) external view override returns (LibPerpetual.TraderPosition memory) {
        return userPosition[account];
    }

    function getGlobalPosition() external view override returns (LibPerpetual.GlobalPosition memory) {
        return globalPosition;
    }

    // functions
    function setPrice(LibPerpetual.Price memory newPrice) external override {
        prices.push(newPrice);
    }

    // missing implementation
    //function calcUnrealizedFundingPayments(address account) external view override returns (uint256) {}

    /// @notice Deposits tokens into the vault. Note that a vault can support multiple collateral tokens.
    function deposit(
        uint256 amount,
        IVault vault,
        IERC20 token
    ) external override {
        IVault oldVault = vaultUsed[msg.sender];
        if (address(oldVault) != address(0)) {
            require(oldVault == vault);
        } else {
            vaultUsed[msg.sender] = vault;
        }
        vault.deposit(amount, token);
    }

    /// @notice Withdraw tokens from the vault. Note that a vault can support multiple collateral tokens.
    function withdraw(
        uint256 amount,
        IVault vault,
        IERC20 token
    ) external override {
        IVault oldVault = vaultUsed[msg.sender];
        if (address(oldVault) != address(0)) {
            require(oldVault == vault);
        } else {
            vaultUsed[msg.sender] = vault;
        }
        vault.deposit(amount, token);
    }

    /// @notice Buys long Quote derivatives
    /// @param amount Amount of Quote tokens to be bought
    /// @dev No checks are done if bought amount exceeds allowance
    function mintLongPosition(uint256 amount) external override returns (uint256) {
        // require(balances[msg.sender].quoteShort == 0, "User can not go long w/ an open short position");
        // require(balances[msg.sender].quoteLong == 0, "User can not go long w/ an open long position"); // since index would be recalculated
        // require(_leverageIsFine(msg.sender, amount), "Leverage factor is too high");

        LibPerpetual.TraderPosition storage traderPosition = userPosition[msg.sender];
        uint256 quoteLongBought = market.mintVBase(amount);

        if (traderPosition.notional > 0) {
            require(traderPosition.side == LibPerpetual.Side.Long, "User can not go long w/ an open short position");
            settle(msg.sender);
            traderPosition.notional += amount.toInt256();
            traderPosition.positionSize += quoteLongBought.toInt256();
        } else {
            traderPosition.side = LibPerpetual.Side.Long;
            traderPosition.notional = amount.toInt256();
            traderPosition.positionSize = quoteLongBought.toInt256();
            traderPosition.timeStamp = globalPosition.timeStamp;
            traderPosition.cumFundingRate = globalPosition.cumFundingRate;
        }
        return quoteLongBought;
    }

    function redeemLongPosition(uint256 amount) external override returns (uint256) {}

    function mintShortPosition(uint256 amount) external override returns (uint256) {}

    function redeemShortPosition(uint256 amount) external override returns (uint256) {}

    function settle(address account) public override {
        LibPerpetual.TraderPosition memory user = userPosition[account];
        LibPerpetual.GlobalPosition memory global = globalPosition;

        if (user.notional != 0 && user.timeStamp < global.timeStamp) {
            // update user variables when position opened before last update

            /* Funding rates (as defined in our protocol) are paid from shorts to longs

            case 1: user is long => has missed receiving funding payments (positive or negative)
            case 2: user is short => has missed making funding payments (positive or negative)

            comment: Making an negative funding payment is equvalent to receiving a positive one.
             */

            int256 upcomingFundingRate = 0;
            int256 upcomingFundingPayment = 0;
            if (user.cumFundingRate != global.cumFundingRate) {
                if (user.side == LibPerpetual.Side.Long) {
                    upcomingFundingRate = global.cumFundingRate - user.cumFundingRate;
                } else {
                    upcomingFundingRate = user.cumFundingRate - global.cumFundingRate;
                }
                upcomingFundingPayment = upcomingFundingRate * user.notional;
            }

            // get user vault
            IVault userVault = getVault(account);
            userVault.applyFundingPayment(account, upcomingFundingPayment);
        }

        // update user variables to global state
        userPosition[account].timeStamp = global.timeStamp;
        userPosition[account].cumFundingRate = global.cumFundingRate;
    }

    function marginIsValid(address account) external view override returns (bool) {}
}
