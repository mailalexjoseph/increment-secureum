// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// dependencies
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {IncreOwnable} from "./utils/IncreOwnable.sol";
import {VirtualToken} from "./tokens/VirtualToken.sol";

// interfaces
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";
import {IOracle} from "./interfaces/IOracle.sol";
import {IVirtualToken} from "./interfaces/IVirtualToken.sol";

// libraries
import {LibMath} from "./lib/LibMath.sol";
import {LibPerpetual} from "./lib/LibPerpetual.sol";
import {LibFunding} from "./lib/LibFunding.sol";

import {MockStableSwap} from "./mocks/MockStableSwap.sol";
import "hardhat/console.sol";

contract Perpetual is IPerpetual, Context, IncreOwnable, Pausable {
    using SafeCast for uint256;
    using SafeCast for int256;

    // parameterization
    int256 constant MIN_MARGIN = 25e15; // 2.5%
    int256 constant LIQUIDATION_FEE = 60e15; // 6%
    int256 constant PRECISION = 10e18;
    uint256 constant TWAP_FREQUENCY = 15 minutes; // time after which funding rate CAN be calculated

    // dependencies
    ICryptoSwap public override market;
    IOracle public override oracle;
    IVirtualToken public override vBase;
    IVirtualToken public override vQuote;
    IVault public override vault;

    // global state
    LibPerpetual.GlobalPosition private globalPosition;
    LibPerpetual.Price[] private prices;

    // user state
    mapping(address => LibPerpetual.TraderPosition) private userPosition;

    constructor(
        IOracle _oracle,
        IVirtualToken _vBase,
        IVirtualToken _vQuote,
        ICryptoSwap _curvePool,
        IVault _vault
    ) {
        oracle = _oracle;
        vBase = _vBase;
        vQuote = _vQuote;
        market = _curvePool;
        vault = _vault;
    }

    // global getter
    function getLatestPrice() public view override returns (LibPerpetual.Price memory) {
        return getPrice(prices.length - 1);
    }

    function getPrice(uint256 period) public view override returns (LibPerpetual.Price memory) {
        return prices[period];
    }

    function getGlobalPosition() public view override returns (LibPerpetual.GlobalPosition memory) {
        return globalPosition;
    }

    // user getter
    function getUserPosition(address account) public view override returns (LibPerpetual.TraderPosition memory) {
        return userPosition[account];
    }

    // functions
    function setPrice(LibPerpetual.Price memory newPrice) external override {
        prices.push(newPrice);
    }

    /// @notice Deposits tokens into the vault
    function deposit(uint256 amount, IERC20 token) external override {
        vault.deposit(_msgSender(), amount, token);
        emit Deposit(_msgSender(), address(token), amount);
    }

    /// @notice Withdraw tokens from the vault
    function withdraw(uint256 amount, IERC20 token) external override {
        require(getUserPosition(_msgSender()).notional == 0, "Has open position");

        vault.withdraw(_msgSender(), amount, token);
        emit Withdraw(_msgSender(), address(token), amount);
    }

    /// @notice Buys long Quote derivatives
    /// @param amount Amount of Quote tokens to be bought
    /// @dev No checks are done if bought amount exceeds allowance
    function openPosition(uint256 amount, LibPerpetual.Side direction) external override returns (uint256) {
        LibPerpetual.TraderPosition storage user = userPosition[_msgSender()];
        LibPerpetual.GlobalPosition storage global = globalPosition;
        require(user.notional == 0, "Trader position is not allowed to have position open");

        updateFundingRate();

        uint256 quoteBought = _openPosition(user, global, direction, amount);

        emit OpenPosition(_msgSender(), uint128(block.timestamp), direction, amount, quoteBought);

        return quoteBought;
    }

    function _openPosition(
        LibPerpetual.TraderPosition storage user,
        LibPerpetual.GlobalPosition storage global,
        LibPerpetual.Side direction,
        uint256 amount
    ) internal returns (uint256) {
        // buy derivative tokens
        user.side = direction;
        uint256 quoteBought = _openPositionOnMarket(amount, direction);

        // set trader position
        user.notional = amount.toInt256();
        user.positionSize = quoteBought.toInt256();
        user.profit = 0;

        user.timeStamp = global.timeStamp;
        user.cumFundingRate = global.cumFundingRate;

        return quoteBought;
    }

    function _openPositionOnMarket(uint256 amount, LibPerpetual.Side direction) internal returns (uint256) {
        uint256 quoteBought = 0;
        if (direction == LibPerpetual.Side.Long) {
            // quoteBought = market.mintVBase(amount);
        } else if (direction == LibPerpetual.Side.Short) {
            // quoteBought = market.burnVBase(amount);
        }
        return quoteBought;
    }

    /// @notice Closes position from account holder
    function closePosition() external override {
        LibPerpetual.TraderPosition storage user = userPosition[_msgSender()];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        updateFundingRate();

        // get information about position
        _closePosition(user, global);
        // apply changes to collateral
        vault.settleProfit(_msgSender(), user.profit);
    }

    function _closePosition(LibPerpetual.TraderPosition storage user, LibPerpetual.GlobalPosition storage global)
        internal
    {
        uint256 amount = (user.positionSize).toUint256();
        LibPerpetual.Side direction = user.side;

        // settle funding rate
        _settle(user, global);

        // sell derivative tokens
        uint256 quoteSold = _closePositionOnMarket(amount, direction);

        // set trader position
        user.profit += _calculatePnL(user.notional, quoteSold.toInt256());
        user.notional = 0;
        user.positionSize = 0;
    }

    // @notice Calculate the funding rate for the next block

    function updateFundingRate() public {
        // TODO: improve funding rate calculations

        ////////////////////////////////// @TOOO wrap this into some library
        uint256 currentTime = block.timestamp;

        LibPerpetual.GlobalPosition storage global = globalPosition;
        uint256 timeOfLastTrade = uint256(global.timeOfLastTrade);

        //  if first trade of block
        if (currentTime > timeOfLastTrade) {
            LibFunding.calculateFunding(
                global,
                market.get_virtual_price().toInt256(),
                oracle.getIndexPrice(),
                currentTime,
                TWAP_FREQUENCY
            );
        }

        ////////////////////////////////// @TOOO wrap this into some library
    }

    // get information about position
    function _calculatePnL(int256 boughtPrice, int256 soldPrice) internal pure returns (int256) {
        return soldPrice - boughtPrice;
    }

    /// notional sell derivative tokens on (external) market
    function _closePositionOnMarket(uint256 amount, LibPerpetual.Side direction) internal returns (uint256) {
        uint256 quoteSold = 0;
        if (direction == LibPerpetual.Side.Long) {
            // quoteSold = market.mintVQuote(amount);
        } else {
            // quoteSold = market.burnVQuote(amount);
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
            emit Settlement(_msgSender(), user.timeStamp, upcomingFundingPayment);
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
            upcomingFundingPayment = LibMath.wadDiv(upcomingFundingRate, user.notional);
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

        // calcuate margin ratio = = (margin + pnl + fundingPayments) / position.getNotional()
        int256 margin = vault.getReserveValue(account);
        int256 fundingPayments = getFundingPayments(user, global);
        int256 unrealizedPnl = 0; /// toDO: requires implementation of curve pool;
        int256 profit = getUserPosition(account).profit;
        return LibMath.wadDiv(margin + unrealizedPnl + fundingPayments + profit, user.notional);
    }

    function liquidate(address account) external {
        require(!marginIsValid(account), "Margin is not valid");
        address liquidator = _msgSender();

        // load information about state
        LibPerpetual.TraderPosition storage user = userPosition[account];
        LibPerpetual.GlobalPosition storage global = globalPosition;
        int256 notionalAmount = user.notional;

        // get information about position
        _closePosition(user, global);

        // liquidation costs
        int256 liquidationFee = (notionalAmount * LIQUIDATION_FEE) / PRECISION;

        // profits - liquidationFee gets paid out
        int256 reducedProfit = user.profit - liquidationFee;

        // substract fee from user account
        vault.settleProfit(account, reducedProfit);

        // add fee to liquidator account
        vault.settleProfit(liquidator, liquidationFee);

        emit LiquidationCall(account, _msgSender(), uint128(block.timestamp), notionalAmount);
    }
}
