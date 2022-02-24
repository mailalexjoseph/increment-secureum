// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {IncreOwnable} from "./utils/IncreOwnable.sol";
import {VirtualToken} from "./tokens/VirtualToken.sol";
import {PoolTWAPOracle} from "./oracles/PoolTWAPOracle.sol";
import {ChainlinkTWAPOracle} from "./oracles/ChainlinkTWAPOracle.sol";

// interfaces
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";
import {IChainlinkOracle} from "./interfaces/IChainlinkOracle.sol";
import {IVirtualToken} from "./interfaces/IVirtualToken.sol";
import {IInsurance} from "./interfaces/IInsurance.sol";

import {IClearingHouse} from "./interfaces/IClearingHouse.sol";

// libraries
import {LibMath} from "./lib/LibMath.sol";
import {LibPerpetual} from "./lib/LibPerpetual.sol";
import {LibReserve} from "./lib/LibReserve.sol";

import "hardhat/console.sol";

contract ClearingHouse is IClearingHouse, Context, IncreOwnable, Pausable {
    using SafeCast for uint256;
    using SafeCast for int256;

    // parameterization
    int256 public constant FEE = 3e16; // 3%
    int256 public constant MIN_MARGIN = 25e15; // 2.5%
    int256 public constant MIN_MARGIN_AT_CREATION = MIN_MARGIN + FEE + 25e15; // initial margin is 2.5% + 3% + 2.5% = 8%
    uint256 public constant LIQUIDATION_REWARD = 60e15; // 6%
    int256 public constant INSURANCE_FEE = 1e15; // 0.1%

    // dependencies
    IVault public vault;
    IInsurance public insurance;
    IPerpetual[] public perpetuals;

    event MarketAdded(uint256 numPerpetuals, IPerpetual indexed perpetual);

    // global state

    constructor(IVault _vault, IInsurance _insurance) {
        vault = _vault;
        insurance = _insurance;
    }

    /* ****************** */
    /*     Governance     */
    /* ****************** */

    function allowListPerpetual(IPerpetual perp) external onlyOwner {
        emit MarketAdded(perpetuals.length, perp);
        perpetuals.push(perp);
    }

    ///// TRADER FLOW OPERATIONS \\\\\

    /// @notice Deposit tokens into the vault
    function deposit(
        uint256 idx,
        uint256 amount,
        IERC20 token
    ) external {
        require(vault.deposit(idx, msg.sender, amount, token) > 0);
        emit Deposit(idx, msg.sender, address(token), amount);
    }

    /// @notice Withdraw tokens from the vault
    function withdraw(
        uint256 idx,
        uint256 amount,
        IERC20 token
    ) external {
        // slither-disable-next-line incorrect-equality
        // slither-disable-next-line timestamp // TODO: sounds incorrect
        require(getTraderPosition(idx, msg.sender).openNotional == 0, "Has open position"); // TODO: can we loosen this restriction (i.e. check marginRatio in the end?)

        require(vault.withdraw(idx, msg.sender, amount, token) > 0);
        emit Withdraw(idx, msg.sender, address(token), amount);
    }

    /// @notice Open position, long or short
    /// @param amount to be sold, in vQuote (if long) or vBase (if short)
    /// @dev No number for the leverage is given but the amount in the vault must be bigger than MIN_MARGIN_AT_CREATION
    /// @dev No checks are done if bought amount exceeds allowance
    function openPosition(
        uint256 idx,
        uint256 amount,
        LibPerpetual.Side direction,
        uint256 minAmount
    ) public returns (int256, int256) {
        /*
            if amount > 0

                trader goes long EUR
                trader accrues openNotional debt
                trader receives positionSize assets

                openNotional = vQuote traded   to market   ( < 0)
                positionSize = vBase received from market ( > 0)

            else amount < 0

                trader goes short EUR
                trader receives openNotional assets
                trader accrues positionSize debt

                openNotional = vQuote received from market ( > 0)
                positionSize = vBase traded   to market   ( < 0)

        */

        require(amount > 0, "The amount can't be null");

        (int256 openNotional, int256 positionSize) = perpetuals[idx].openPosition(
            msg.sender,
            amount,
            direction,
            minAmount
        );

        // pay insurance fee: TODO: can never withdraw this amount!
        int256 insuranceFee = LibMath.wadMul(LibMath.abs(openNotional), INSURANCE_FEE);
        vault.settleProfit(idx, msg.sender, -insuranceFee);
        vault.settleProfit(idx, address(insurance), insuranceFee);

        require(marginIsValid(idx, msg.sender, MIN_MARGIN_AT_CREATION), "Not enough margin");

        emit OpenPosition(idx, msg.sender, uint128(block.timestamp), direction, openNotional, positionSize);

        return (openNotional, positionSize);
    }

    /// @notice Closes position from account holder
    /// @param tentativeVQuoteAmount Amount of vQuote tokens to be sold for SHORT positions (anything works for LONG position)
    function closePosition(
        uint256 idx,
        uint256 tentativeVQuoteAmount,
        uint256 minAmount
    ) external {
        LibPerpetual.UserPosition memory trader = getTraderPosition(idx, msg.sender);
        LibPerpetual.Side direction = trader.positionSize > 0 ? LibPerpetual.Side.Long : LibPerpetual.Side.Short;

        require(trader.openNotional != 0, "No position currently opened");

        int256 profit = perpetuals[idx].closePosition(msg.sender, tentativeVQuoteAmount, minAmount);

        // apply changes to collateral
        vault.settleProfit(idx, msg.sender, profit);

        emit ClosePosition(
            idx,
            msg.sender,
            uint128(block.timestamp),
            direction,
            trader.openNotional,
            trader.positionSize
        );
    }

    function marginIsValid(
        uint256 idx,
        address account,
        int256 ratio
    ) public view returns (bool) {
        // slither-disable-next-line timestamp
        return marginRatio(idx, account) >= ratio;
    }

    function marginRatio(uint256 idx, address account) public view returns (int256) {
        // margin ratio = (collateral + unrealizedPositionPnl + fundingPayments) / trader.openNotional
        // all amounts must be expressed in vQuote (e.g. USD), otherwise the end result doesn't make sense

        int256 collateral = getReserveValue(idx, account);
        int256 fundingPayments = getFundingPayments(idx, account);
        int256 unrealizedPositionPnl = getUnrealizedPnL(idx, account);
        int256 openNotional = getTraderPosition(idx, account).openNotional;

        int256 positiveOpenNotional = LibMath.abs(openNotional);
        return LibMath.wadDiv(collateral + unrealizedPositionPnl + fundingPayments, positiveOpenNotional);
    }

    /// @param tentativeVQuoteAmount Amount of vQuote tokens to be sold for SHORT positions (anything works for LONG position)
    function liquidate(
        uint256 idx,
        address liquidatee,
        uint256 tentativeVQuoteAmount
    ) external {
        address liquidator = msg.sender;

        uint256 positiveOpenNotional = uint256(LibMath.abs(perpetuals[idx].getTraderPosition(liquidatee).openNotional));

        require(getTraderPosition(idx, liquidatee).openNotional != 0, "No position currently opened");
        require(!marginIsValid(idx, liquidatee, MIN_MARGIN), "Margin is valid");

        int256 profit = perpetuals[idx].closePosition(liquidatee, tentativeVQuoteAmount, 0);

        // adjust liquidator vault amount

        uint256 liquidationRewardAmount = LibMath.wadMul(positiveOpenNotional, LIQUIDATION_REWARD);

        // subtract reward from liquidatee
        int256 reducedProfit = profit - liquidationRewardAmount.toInt256();
        vault.settleProfit(idx, liquidatee, reducedProfit);

        // add reward to liquidator
        vault.settleProfit(idx, liquidator, liquidationRewardAmount.toInt256());

        emit LiquidationCall(idx, liquidatee, liquidator, uint128(block.timestamp), positiveOpenNotional);
    }

    ///// LIQUIDITY PROVISIONING FLOW OPERATIONS \\\\\

    /// @notice Provide liquidity to the pool
    /// @param amount of token to be added to the pool (with token decimals)
    /// @param  token to be added to the pool
    function provideLiquidity(
        uint256 idx,
        uint256 amount,
        IERC20 token
    ) external returns (uint256, uint256) {
        // slither-disable-next-line timestamp // TODO: sounds incorrect
        require(amount != 0, "Zero amount");
        // slither-disable-next-line timestamp // TODO: sounds incorrect
        require(perpetuals[idx].getLpPosition(msg.sender).liquidityBalance == 0, "Has provided liquidity before"); // TODO: can we loosen this restriction (must settle funding!)

        // split liquidity between long and short (TODO: account for value of liquidity provider already made)
        uint256 wadAmount = vault.deposit(idx, msg.sender, amount, token);

        uint256 baseAmount = perpetuals[idx].provideLiquidity(msg.sender, wadAmount);

        emit LiquidityProvided(idx, msg.sender, address(token), amount);
        return (wadAmount, baseAmount);
    }

    /// @notice Remove liquidity from the pool (but don't close LP position and withdraw amount)
    /// @param amount of liquidity to be removed from the pool (with 18 decimals)
    function removeLiquidity(uint256 idx, uint256 amount) external {
        perpetuals[idx].removeLiquidity(msg.sender, amount);
        emit LiquidityRemoved(idx, msg.sender, amount);
    }

    /// @notice Remove liquidity from the pool (but don't close LP position and withdraw amount)
    /// @param tentativeVQuoteAmount at which to buy the LP position (if it looks like a short, more vQuote than vBase)
    function settleAndWithdrawLiquidity(uint256 idx, uint256 tentativeVQuoteAmount) external {
        // profit = pnl + fundingPayments
        int256 profit = perpetuals[idx].settleAndWithdrawLiquidity(msg.sender, tentativeVQuoteAmount);
        vault.settleProfit(idx, msg.sender, profit);

        // remove the liquidity provider from the list
        // slither-disable-next-line unused-return // can be zero amount
        vault.withdrawAll(idx, msg.sender, vault.reserveToken());

        emit LiquidityWithdrawn(idx, msg.sender);
    }

    /// @notice Return amount for vBase one would receive for exchanging `vQuoteAmountToSpend` in a select market (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `openPosition`
    function getExpectedVBaseAmount(uint256 idx, uint256 vQuoteAmountToSpend) public view returns (uint256) {
        return perpetuals[idx].getExpectedVBaseAmount(vQuoteAmountToSpend);
    }

    /// @notice Return amount for vQuote one would receive for exchanging `vBaseAmountToSpend` in a select market (excluding slippage)
    /// @dev It's up to the client to apply a reduction of this amount (e.g. -1%) to then use it as `minAmount` in `openPosition`
    function getExpectedVQuoteAmount(uint256 idx, uint256 vBaseAmountToSpend) public view returns (uint256) {
        return perpetuals[idx].getExpectedVQuoteAmount(vBaseAmountToSpend);
    }

    /// @notice Calculate missed funding payments
    // slither-disable-next-line timestamp
    function getFundingPayments(uint256 idx, address account) public view returns (int256 upcomingFundingPayment) {
        return perpetuals[idx].getFundingPayments(account);
    }

    function getUnrealizedPnL(uint256 idx, address account) public view returns (int256) {
        return perpetuals[idx].getUnrealizedPnL(account);
    }

    function getReserveValue(uint256 idx, address account) public view returns (int256) {
        return vault.getReserveValue(idx, account);
    }

    /// @notice Return the curve price oracle
    function marketPriceOracle(uint256 idx) external view returns (uint256) {
        return perpetuals[idx].marketPriceOracle();
    }

    /// @notice Return the last traded price (used for TWAP)
    function marketPrice(uint256 idx) external view returns (uint256) {
        return perpetuals[idx].marketPrice();
    }

    /// @notice Return the current off-chain exchange rate for vBase/vQuote
    function indexPrice(uint256 idx) external view returns (int256) {
        return perpetuals[idx].indexPrice();
    }

    function getGlobalPosition(uint256 idx) external view returns (LibPerpetual.GlobalPosition memory) {
        return perpetuals[idx].getGlobalPosition();
    }

    function getTraderPosition(uint256 idx, address account) public view returns (LibPerpetual.UserPosition memory) {
        return perpetuals[idx].getTraderPosition(account);
    }

    function getLpPosition(uint256 idx, address account) external view returns (LibPerpetual.UserPosition memory) {
        return perpetuals[idx].getLpPosition(account);
    }

    function numMarkets() public view returns (uint256) {
        return perpetuals.length;
    }
}
