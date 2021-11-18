// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {LibMath} from "./lib/LibMath.sol";

import {LibPerpetual} from "./lib/LibPerpetual.sol";

import {MockStableSwap} from "./mocks/MockStableSwap.sol";

contract Perpetual is IPerpetual, Context {
    using SafeCast for uint256;
    using SafeCast for int256;
    event LogFundingPayment(uint256 indexed blockNumber, uint256 value, bool isPositive);

    // parameterization
    int256 constant MIN_MARGIN = 25e15; // 2.5%
    int256 constant LIQUIDATION_FEE = 60e15; // 6%
    int256 constant PRECISION = 10e18;

    // global state
    MockStableSwap private market;
    LibPerpetual.GlobalPosition private globalPosition;
    LibPerpetual.Price[] private prices;

    // user state
    mapping(address => LibPerpetual.TraderPosition) private userPosition;
    mapping(address => IVault) private vaultUsed;

    constructor(uint256 _vQuote, uint256 _vBase) {
        market = new MockStableSwap(_vQuote, _vBase);
    }

    // viewer function
    function getLatestPrice() public view override returns (LibPerpetual.Price memory) {
        return getPrice(prices.length - 1);
    }

    function getPrice(uint256 period) public view override returns (LibPerpetual.Price memory) {
        return prices[period];
    }

    function getUserProfit(address account) public view override returns (int256) {
        return userPosition[account].profit;
    }

    function getVault(address account) public view override returns (IVault) {
        return vaultUsed[account];
    }

    function getUserPosition(address account) public view override returns (LibPerpetual.TraderPosition memory) {
        return userPosition[account];
    }

    function getGlobalPosition() public view override returns (LibPerpetual.GlobalPosition memory) {
        return globalPosition;
    }

    // functions
    function setPrice(LibPerpetual.Price memory newPrice) external override {
        prices.push(newPrice);
    }

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
        require(getUserPosition(_msgSender()).notional == 0, "Has open position");
        vault.withdraw(amount, token);
    }

    /// @notice Buys long Quote derivatives
    /// @param amount Amount of Quote tokens to be bought
    /// @dev No checks are done if bought amount exceeds allowance
    function openPosition(uint256 amount, LibPerpetual.Side direction) external override returns (uint256) {
        LibPerpetual.TraderPosition storage traderPosition = userPosition[_msgSender()];
        require(traderPosition.notional == 0, "Trader position is not allowed to have position open");

        // buy derivative tokens
        traderPosition.side = direction;
        uint256 quoteBought = 0;
        if (direction == LibPerpetual.Side.Long) {
            quoteBought = market.mintVBase(amount);
        } else if (direction == LibPerpetual.Side.Short) {
            quoteBought = market.burnVBase(amount);
        } else {
            return 0;
        }

        // set trader position
        traderPosition.notional = amount.toInt256();
        traderPosition.positionSize = quoteBought.toInt256();
        traderPosition.profit = 0;

        traderPosition.timeStamp = globalPosition.timeStamp;
        traderPosition.cumFundingRate = globalPosition.cumFundingRate;

        return quoteBought;
    }

    /// @notice Closes position from account holder
    function closePosition() external override {
        LibPerpetual.TraderPosition storage traderPosition = userPosition[_msgSender()];
        LibPerpetual.GlobalPosition storage global = globalPosition;
        // get information about position
        _closePosition(traderPosition, global);
        // apply changes to collateral
        IVault userVault = vaultUsed[_msgSender()];
        userVault.settleProfit(_msgSender(), traderPosition.profit);
    }

    function _closePosition(
        LibPerpetual.TraderPosition storage traderPosition,
        LibPerpetual.GlobalPosition storage global
    ) internal {
        uint256 amount = (traderPosition.positionSize).toUint256();
        LibPerpetual.Side direction = traderPosition.side;

        // settle funding rate
        _settle(traderPosition, global);

        // sell derivative tokens
        uint256 quoteSold = _closePositionOnMarket(amount, direction);

        // set trader position
        traderPosition.profit += _calculatePnL(traderPosition.notional, quoteSold.toInt256());
        traderPosition.notional = 0;
        traderPosition.positionSize = 0;
    }

    // get information about position
    function _calculatePnL(int256 boughtPrice, int256 soldPrice) internal pure returns (int256) {
        return soldPrice - boughtPrice;
    }

    /// notional sell derivative tokens on (external) market
    function _closePositionOnMarket(uint256 amount, LibPerpetual.Side direction) internal returns (uint256) {
        uint256 quoteSold = 0;
        if (direction == LibPerpetual.Side.Long) {
            quoteSold = market.mintVQuote(amount);
        } else {
            quoteSold = market.burnVQuote(amount);
        }
        return quoteSold;
    }

    /// @notice Settle funding rate
    function settle(address account) public override {
        LibPerpetual.TraderPosition storage user = userPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;
        _settle(user, global);
    }

    function _settle(LibPerpetual.TraderPosition storage user, LibPerpetual.GlobalPosition storage global) internal {
        if (user.notional != 0 && user.timeStamp < global.timeStamp) {
            // update user variables when position opened before last update
            int256 upcomingFundingPayment = getFundingPayments(user, global);
            _applyFundingPayment(user, upcomingFundingPayment);
        }

        // update user variables to global state
        user.timeStamp = global.timeStamp;
        user.cumFundingRate = global.cumFundingRate;
    }

    /// @notice Apply funding payments
    function _applyFundingPayment(LibPerpetual.TraderPosition storage user, int256 payments) internal {
        user.profit += payments;
    }

    /// @notice Calculate missed funing payments
    function getFundingPayments(LibPerpetual.TraderPosition memory user, LibPerpetual.GlobalPosition memory global)
        public
        pure
        returns (int256)
    {
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
            upcomingFundingPayment = LibMath.mul(upcomingFundingRate, user.notional);
        }
        return upcomingFundingPayment;
    }

    function marginIsValid(address account) public view override returns (bool) {
        return marginRatio(account) <= MIN_MARGIN;
    }

    /// @notice Calculate the margin Ratio of some account
    function marginRatio(address account) public view override returns (int256) {
        LibPerpetual.TraderPosition memory user = getUserPosition(account);
        LibPerpetual.GlobalPosition memory global = getGlobalPosition();
        IVault userVault = getVault(account);

        // calcuate margin ratio = = (margin + pnl + fundingPayments) / position.getNotional()
        int256 margin = userVault.getReserveValue(account);
        int256 fundingPayments = getFundingPayments(user, global);
        int256 unrealizedPnl = 0; /// toDO: requires implementation of curve pool;
        int256 profit = getUserProfit(account);
        return LibMath.div(margin + unrealizedPnl + fundingPayments + profit, user.notional);
    }

    function liquidate(address account) external {
        require(!marginIsValid(account), "Margin is not valid");
        address liquidator = _msgSender();

        // load information about state
        LibPerpetual.TraderPosition storage traderPosition = userPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;
        int256 notionalAmount = traderPosition.notional;

        // get information about position
        _closePosition(traderPosition, global);

        // liquidation costs
        int256 liquidationFee = (notionalAmount * LIQUIDATION_FEE) / PRECISION;

        // profits - liquidationFee gets paid out
        int256 reducedProfit = traderPosition.profit - liquidationFee;

        // substract fee from user account
        IVault userVault = vaultUsed[account];
        userVault.settleProfit(account, reducedProfit);

        // add fee to liquidator account
        IVault liquidatorVault = vaultUsed[liquidator];
        liquidatorVault.settleProfit(liquidator, liquidationFee);
    }
}
