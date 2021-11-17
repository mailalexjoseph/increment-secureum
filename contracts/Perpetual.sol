// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PRBMathSD59x18} from "prb-math/contracts/PRBMathSD59x18.sol";

import {LibPerpetual} from "./lib/LibPerpetual.sol";

import {MockStableSwap} from "./mocks/MockStableSwap.sol";

contract Perpetual is IPerpetual, Context {
    using SafeCast for uint256;
    using SafeCast for int256;
    event LogFundingPayment(uint256 indexed blockNumber, uint256 value, bool isPositive);

    /// @notice Margin ratio for full liquidation
    int256 constant minMargin = 25e15; // 2.5%
    /// @notice Liquidation fee
    int256 constant liquidationFee = 60e15; // 6%

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

    function getVault(address account) public view override returns (IVault) {
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
        IVault oldVault = vaultUsed[_msgSender()];
        if (address(oldVault) != address(0)) {
            require(oldVault == vault);
        } else {
            vaultUsed[_msgSender()] = vault;
        }
        vault.deposit(amount, token);
    }

    /// @notice Withdraw tokens from the vault. Note that a vault can support multiple collateral tokens.
    function withdraw(
        uint256 amount,
        IVault vault,
        IERC20 token
    ) external override {
        IVault oldVault = vaultUsed[_msgSender()];
        if (address(oldVault) != address(0)) {
            require(oldVault == vault);
        } else {
            vaultUsed[_msgSender()] = vault;
        }
        vault.withdraw(amount, token);
    }

    /// @notice Buys long Quote derivatives
    /// @param amount Amount of Quote tokens to be bought
    /// @dev No checks are done if bought amount exceeds allowance
    function openPosition(uint256 amount, LibPerpetual.Side direction) external override returns (uint256) {
        // require(balances[_msgSender()].quoteShort == 0, "User can not go long w/ an open short position");
        // require(balances[_msgSender()].quoteLong == 0, "User can not go long w/ an open long position"); // since index would be recalculated
        // require(_leverageIsFine(_msgSender(), amount), "Leverage factor is too high");

        LibPerpetual.TraderPosition storage traderPosition = userPosition[_msgSender()];
        require(traderPosition.notional == 0, "Trader position is not allowed to have position open");
        uint256 quoteBought = 0;

        // tODO: replace by curve logic
        if (direction == LibPerpetual.Side.Long) {
            quoteBought = market.mintVBase(amount);
        } else if (direction == LibPerpetual.Side.Short) {
            quoteBought = market.burnVBase(amount);
        } else {
            return 0;
        }

        traderPosition.notional = amount.toInt256();
        traderPosition.positionSize = quoteBought.toInt256();
        traderPosition.debt = 0;
        traderPosition.side = direction;
        traderPosition.timeStamp = globalPosition.timeStamp;
        traderPosition.cumFundingRate = globalPosition.cumFundingRate;

        return quoteBought;
    }

    function closePosition(uint256 amount, LibPerpetual.Side direction) external override returns (uint256) {
        LibPerpetual.TraderPosition storage traderPosition = userPosition[_msgSender()];
        require(traderPosition.notional == amount.toInt256(), "More shares than expected");
        settle(_msgSender());
        uint256 quoteSold = _closePosition(amount, _msgSender(), direction);
        traderPosition.debt += traderPosition.notional - quoteSold.toInt256();

        IVault userVault = vaultUsed[_msgSender()];
        userVault.settleDebt(_msgSender(), traderPosition.debt);
        traderPosition.notional = 0;
        traderPosition.positionSize = 0;
        return quoteSold;
    }

    function _closePosition(
        uint256 amount,
        address user,
        LibPerpetual.Side direction
    ) private returns (uint256) {
        LibPerpetual.TraderPosition memory traderPosition = userPosition[user];
        require(traderPosition.side == direction, "Wrong position");
        require(traderPosition.notional == amount.toInt256(), "User must close close full position");
        uint256 quoteSold = 0;

        require(direction == LibPerpetual.Side.Long || direction == LibPerpetual.Side.Short, "Unknown direction");
        // tODO: replace by curve logic
        if (direction == LibPerpetual.Side.Long) {
            quoteSold = market.mintVQuote(amount);
        } else {
            quoteSold = market.burnVQuote(amount);
        }
        return quoteSold;
    }

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
                upcomingFundingPayment = PRBMathSD59x18.mul(upcomingFundingRate, user.notional);
            }

            applyFundingPayment(account, upcomingFundingPayment);
        }

        // update user variables to global state
        userPosition[account].timeStamp = global.timeStamp;
        userPosition[account].cumFundingRate = global.cumFundingRate;
    }

    function liquidate(address account) external {}

    function marginIsValid(address account) external view override returns (bool) {}

    function applyFundingPayment(address account, int256 newDebt) internal {
        userPosition[account].debt += newDebt;
    }
}
