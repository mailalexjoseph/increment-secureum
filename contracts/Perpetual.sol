// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// contracts
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
    int256 public constant MIN_MARGIN = 25e15; // 2.5%
    int256 public constant LIQUIDATION_FEE = 60e15; // 6%
    int256 public constant PRECISION = 10e18;
    uint256 public constant TWAP_FREQUENCY = 15 minutes; // time after which funding rate CAN be calculated
    int256 public constant FEE = 3e16; // 3%
    int256 public constant MIN_MARGIN_AT_CREATION = MIN_MARGIN + FEE;

    // dependencies
    ICryptoSwap public override market;
    IOracle public override oracle;
    IVirtualToken public override vBase;
    IVirtualToken public override vQuote;
    IVault public override vault;

    // global state
    LibPerpetual.GlobalPosition private globalPosition;
    LibPerpetual.Price[] private prices;
    uint256 public totalLiquidityProvided;

    // liquidity provider state
    mapping(address => uint256) private liquidityProvided;

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

        // approve all future transfers between Perpetual and market (curve pool)
        vBase.approve(address(market), type(uint256).max);
        vQuote.approve(address(market), type(uint256).max);
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

    /// @notice Open position, long or short
    /// @param amount Amount of virtual tokens to be bought
    /// @param direction Side of the position to open, long or short
    /// @dev No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGIN
    /// @dev No checks are done if bought amount exceeds allowance
    function openPosition(uint256 amount, LibPerpetual.Side direction) external override returns (uint256) {
        address sender = _msgSender();
        LibPerpetual.TraderPosition storage user = userPosition[sender];
        LibPerpetual.GlobalPosition storage global = globalPosition;

        // Checks
        require(amount > 0, "The amount can't be null");
        require(user.notional == 0, "Trader position is not allowed to have a position already open");

        int256 prospectiveMargin = LibMath.wadDiv(vault.getReserveValue(sender), amount.toInt256());
        require(prospectiveMargin >= MIN_MARGIN_AT_CREATION, "Not enough funds in the vault for this position");

        // updateFundingRate();

        // Buy virtual tokens for the position
        uint256 quoteBought = _openPositionOnMarket(amount, direction);

        // Update trader position
        user.notional = amount.toInt256();
        user.positionSize = quoteBought.toInt256();
        user.profit = 0;
        user.side = direction;
        user.timeStamp = global.timeStamp; // note: timestamp of the last update of the cumFundingRate
        user.cumFundingRate = global.cumFundingRate;

        emit OpenPosition(sender, uint128(block.timestamp), direction, amount, quoteBought);
        return quoteBought;
    }

    function _openPositionOnMarket(uint256 amount, LibPerpetual.Side direction) internal returns (uint256) {
        uint256 quoteBought = 0;

        if (direction == LibPerpetual.Side.Long) {
            vQuote.mint(amount);
            // NOTE: this works
            // quoteBought = market.balances(1);

            // NOTE: this works
            // // create tokens to be supplied to the pool
            // vQuote.mint(amount);
            // vBase.mint(amount);
            // // supply liquidity to curve pool
            // uint256 min_mint_amount = 0;
            // uint256[2] memory mint_amounts = [amount, amount];
            // market.add_liquidity(mint_amounts, min_mint_amount);

            // NOTE: this doesn't work
            // quoteBought = market.get_dy(1, 0, amount);

            // NOTE: this doesn't work
            // assumption: vQuote is the 1st token, vBase is the 2nd one
            uint256 firstCoin = 0;
            uint256 secondCoin = 1;
            quoteBought = market.exchange(firstCoin, secondCoin, 100000, 0);
        } else if (direction == LibPerpetual.Side.Short) {
            vBase.mint(amount);
            quoteBought = market.exchange(0, 1, amount, 0);
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
                marketPrice().toInt256(),
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

    // @notice Return the current market price
    function marketPrice() public view returns (uint256) {
        return market.price_oracle(); // vBase / vQuote
    }

    function indexPrice() public view returns (int256) {
        return oracle.getIndexPrice();
    }

    function marginIsValid(address account) public view override returns (bool) {
        return marginRatio(account) <= MIN_MARGIN;
    }

    /// @notice Provide liquidity to the pool
    /// @param amount of token to be added to the pool (with token decimals)
    /// @param  token to be added to the pool
    function provideLiquidity(uint256 amount, IERC20 token) external override returns (uint256, uint256) {
        address sender = _msgSender();
        require(amount != 0, "Zero amount");
        require(liquidityProvided[sender] == 0, "Has provided liquidity before");

        // return amount with 18 decimals
        uint256 wadAmount = vault.deposit(_msgSender(), amount, token);

        uint256 price;
        if (totalLiquidityProvided == 0) {
            price = indexPrice().toUint256();
        } else {
            price = marketPrice();
        }
        // split liquidity between long and short (TODO: account for value of liquidity provider already made)
        uint256 vQuoteAmount = wadAmount / 2;
        uint256 vBaseAmount = LibMath.wadDiv(vQuoteAmount, price); // vUSD / vEUR/vUSD  <=> 1 / 1.2 = 0.83

        // mint tokens
        vQuote.mint(vQuoteAmount);
        vBase.mint(vBaseAmount);

        // supply liquidity to curve pool
        //uint256 min_mint_amount = 0; // set to zero for now
        market.add_liquidity([vQuoteAmount, vBaseAmount], 0); //  first token in curve pool is vQuote & second token is vBase

        // increment balances
        liquidityProvided[sender] += amount; // with 6 decimals
        totalLiquidityProvided += wadAmount; // with 18 decimals

        emit LiquidityProvided(sender, address(token), amount);
        return (vBaseAmount, vQuoteAmount);
    }

    /// @notice Withdraw liquidity from the pool
    /// @param amount of liquidity to be removed from the pool (with 18 decimals)
    /// @param  token to be removed from the pool
    function withdrawLiquidity(uint256 amount, IERC20 token) external override returns (uint256, uint256) {
        address sender = _msgSender();
        require(liquidityProvided[msg.sender] >= amount, "Not enough liquidity provided");

        // withdraw from curve pool
        uint256 withdrawAmount = amount * market.get_virtual_price();

        // remove liquidity from th epool
        uint256[2] memory amountReturned;

        // remove liquidity from curve pool
        // calc_token_amount
        try market.remove_liquidity(withdrawAmount, [uint256(0), uint256(0)]) returns (uint256[2] memory result) {
            amountReturned = result;
        } catch Error(string memory reason) {
            // This is executed in case
            // revert was called inside removeLiquidity
            // and a reason string was provided.
            console.log("hardhat: error", reason);
            return (0, 0);
        } catch Panic(uint256 errorCode) {
            // This is executed in case of a panic,
            // i.e. a serious error like division by zero
            // or overflow. The error code can be used
            // to determine the kind of error.
            console.log("hardhat: panic", errorCode);
            return (0, 0);
        } catch (bytes memory lowLevelData) {
            console.log("hardhat: other");
            console.logBytes(lowLevelData);
            //console.log(lowLevelData);
            // This is executed in case revert() was used.
            return (0, 0);
        }

        uint256 vBaseAmount = amountReturned[0];
        uint256 vQuoteAmount = amountReturned[1];

        // burn virtual tokens
        vBase.burn(vBaseAmount);
        vQuote.burn(vQuoteAmount);

        // TODO: calculate profit from operation ... profit = returned money - deposited money
        uint256 price;
        if (totalLiquidityProvided == 0) {
            price = indexPrice().toUint256();
        } else {
            price = marketPrice();
        }
        // split liquidity between long and short (TODO: account for value of liquidity provider already made)
        uint256 withdrawableAmount = vQuoteAmount + LibMath.wadMul(vBaseAmount, price);

        int256 profit = liquidityProvided[sender].toInt256() - withdrawableAmount.toInt256();
        vault.settleProfit(sender, profit);
        vault.withdrawAll(sender, token); // TODO: withdraw all liquidity

        // lower balances
        liquidityProvided[sender] -= amount;
        totalLiquidityProvided -= amount;

        emit LiquidityWithdrawn(sender, address(token), amount);
        return (vBaseAmount, vQuoteAmount);
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
