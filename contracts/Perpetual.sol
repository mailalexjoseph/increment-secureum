// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// dependencies
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";

// interfaces
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";
import {IOracle} from "./interfaces/IOracle.sol";

// libraries
import {LibMath} from "./lib/LibMath.sol";
import {LibPerpetual} from "./lib/LibPerpetual.sol";
import {IncreOwnable} from "./utils/IncreOwnable.sol";

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
    ICryptoSwap private market;
    IOracle private oracle;

    // global state
    LibPerpetual.GlobalPosition private globalPosition;
    LibPerpetual.Price[] private prices;
    mapping(IVault => bool) private vaultInitialized;

    // user state
    mapping(address => LibPerpetual.TraderPosition) private userPosition;
    mapping(address => IVault) private vaultUsed;

    constructor(IOracle _oracle) {
        oracle = _oracle;
        _pause();
    }

    // global getter
    function getStableSwap() public view returns (address) {
        return address(market);
    }

    function isVault(address vaultAddress) public view returns (bool) {
        return vaultInitialized[IVault(vaultAddress)];
    }

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
    function getVault(address account) public view override returns (IVault) {
        return vaultUsed[account];
    }

    function getUserPosition(address account) public view override returns (LibPerpetual.TraderPosition memory) {
        return userPosition[account];
    }

    // functions
    function setMarket(ICryptoSwap _market) external override onlyOwner {
        market = _market;
    }

    function setVault(address vaultAddress) public onlyOwner {
        IVault vault = IVault(vaultAddress);
        require(vaultInitialized[vault] == false, "Vault is already initialized");
        vaultInitialized[vault] = true;
        emit VaultRegistered(vaultAddress);
    }

    function setPrice(LibPerpetual.Price memory newPrice) external override {
        prices.push(newPrice);
    }

    function _verifyAndSetVault(IVault vault) internal {
        require(vaultInitialized[vault], "Vault is not initialized");
        IVault oldVault = vaultUsed[_msgSender()];
        if (address(oldVault) == address(0)) {
            // create new vault
            vaultUsed[_msgSender()] = vault;
            emit VaultAssigned(_msgSender(), address(vault));
        } else {
            // check uses same vault
            require(oldVault == vault, "Uses other vault");
        }
    }

    /// @notice Deposits tokens into the vault. Note that a vault can support multiple collateral tokens.
    function deposit(
        uint256 amount,
        IVault vault,
        IERC20 token
    ) external override {
        _verifyAndSetVault(vault);
        vault.deposit(_msgSender(), amount, token);
        emit Deposit(_msgSender(), address(token), amount);
    }

    /// @notice Withdraw tokens from the vault. Note that a vault can support multiple collateral tokens.
    function withdraw(uint256 amount, IERC20 token) external override {
        require(getUserPosition(_msgSender()).notional == 0, "Has open position");
        IVault vault = vaultUsed[_msgSender()];

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
        IVault userVault = vaultUsed[_msgSender()];
        userVault.settleProfit(_msgSender(), user.profit);
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
            int256 marketPrice = market.get_virtual_price().toInt256(); // is this the correct price?
            int256 indexPrice = oracle.getIndexPrice();
            int256 premium = (LibMath.div(marketPrice - indexPrice, indexPrice) * TWAP_FREQUENCY.toInt256()) / (1 days);

            // add to cumulative price if no block in trade yet
            global.cumTradeVolume += LibMath.mul((currentTime - timeOfLastTrade).toInt256(), global.priceOfLastTrade);

            // reset time
            global.timeOfLastTrade = currentTime.toUint128();
        }

        uint256 lastFundingUpdate = uint256(global.timeStamp);
        uint256 nextFundingRateUpdate = lastFundingUpdate + TWAP_FREQUENCY;

        //  if funding rate should be updated
        if (currentTime >= nextFundingRateUpdate) {
            // get time since last funding rate update
            int256 timePassed = (currentTime - lastFundingUpdate).toInt256();

            // update new funding Rate if 15 minutes have passed
            global.cumFundingRate = LibMath.div(global.cumTradeVolume, timePassed);

            // reset time & volume
            global.timeStamp = currentTime.toUint128();
            global.cumTradeVolume = 0;
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
        int256 profit = getUserPosition(account).profit;
        return LibMath.div(margin + unrealizedPnl + fundingPayments + profit, user.notional);
    }

    function liquidate(address account, IVault liquidatorVault) external {
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
        IVault userVault = vaultUsed[account];
        userVault.settleProfit(account, reducedProfit);

        // add fee to liquidator account
        _verifyAndSetVault(liquidatorVault);
        liquidatorVault.settleProfit(liquidator, liquidationFee);

        emit LiquidationCall(account, _msgSender(), uint128(block.timestamp), notionalAmount);
    }
}
