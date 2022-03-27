// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {PRBMathSD59x18} from "prb-math/contracts/PRBMathSD59x18.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IncreOwnable} from "./utils/IncreOwnable.sol";

// interfaces
import {IInsurance} from "./interfaces/IInsurance.sol";
import {IVault} from "./interfaces/IVault.sol";
import {IERC20Decimals} from "./interfaces/IERC20Decimals.sol";
import {IClearingHouse} from "./interfaces/IClearingHouse.sol";

// libraries
import {LibReserve} from "./lib/LibReserve.sol";
import {LibMath} from "./lib/LibMath.sol";

import "hardhat/console.sol";

/// @notice Keeps track of all token reserves for all market
/// @dev Vault must be called right after Perpetual is deployed to set Perpetual as the owner of the contract
contract Vault is IVault, Context, IncreOwnable {
    using SafeERC20 for IERC20;
    using LibMath for uint256;
    using LibMath for int256;

    // constants
    uint256 internal constant MAX_DECIMALS = 18;
    uint256 internal immutable reserveTokenDecimals;

    // parameterization
    int256 internal constant MIN_DEPOSIT_AMOUNT = 10e18; // min deposit of 10

    // dependencies
    IERC20 public immutable override reserveToken;
    IClearingHouse public override clearingHouse;
    IInsurance public override insurance;

    // global state
    uint256 internal badDebt;
    uint256 internal maxTVL;
    uint256 internal totalReserveToken;

    // user state

    /* Balances of users and liquidity providers

    We follow a strict separate margin design where have to deposit collateral for any market

    There exists two balances with a special type of meaning:

    traderBalances[0][clearingHouse.address] := insurance reserve of the protocol
    traderBalances[1][clearingHouse.address] := profit earned by governance from selling dust

            market     =>      trader  => balance
    */
    mapping(uint256 => mapping(address => int256)) private traderBalances;
    mapping(uint256 => mapping(address => int256)) private lpBalances;

    constructor(IERC20 _reserveToken) {
        require(address(_reserveToken) != address(0), "Token can not be zero address");
        require(
            IERC20Decimals(address(_reserveToken)).decimals() <= MAX_DECIMALS,
            "Has to have not more than 18 decimals"
        );

        // set contract addresses
        reserveToken = _reserveToken;

        // set other parameters
        reserveTokenDecimals = IERC20Decimals(address(_reserveToken)).decimals();
    }

    modifier onlyClearingHouse() {
        require(msg.sender == address(clearingHouse), "NO CLEARINGHOUSE");
        _;
    }

    /* ****************** */
    /*     User flow      */
    /* ****************** */

    /// @notice Deposit reserveTokens to account
    /// @param idx Index of the perpetual market
    /// @param user Account to deposit to
    /// @param tokenAmount Amount to be used as the collateral of the position. Might not be 18 decimals
    /// @param depositToken Token to be used for the collateral of the position
    /// @param isTrader True if the user is a trader, False if the user is a liquidity provider
    /// @return Deposited Amount. 18 decimals
    function deposit(
        uint256 idx,
        address user,
        uint256 tokenAmount,
        IERC20 depositToken,
        bool isTrader
    ) external override onlyClearingHouse returns (uint256) {
        require(depositToken == reserveToken, "Wrong token");

        uint256 wadAmount = LibReserve.tokenToWad(reserveTokenDecimals, tokenAmount);

        // deposit must exceed 10
        require(wadAmount.toInt256() >= MIN_DEPOSIT_AMOUNT, "MIN_DEPOSIT_AMOUNT");

        // increment balance
        _changeBalance(idx, user, wadAmount.toInt256(), isTrader);
        totalReserveToken += wadAmount;

        require(totalReserveToken <= maxTVL, "MAX_TVL");

        // deposit reserveTokens to contract
        IERC20(depositToken).safeTransferFrom(user, address(this), tokenAmount);

        emit ValueLockedChanged(totalReserveToken);

        return wadAmount;
    }

    /// @notice Withdraw all tokens from account
    /// @param idx Index of the perpetual market
    /// @param user Account to withdraw from
    /// @param withdrawToken Token to be withdrawn from the vault
    /// @param isTrader True if the user is a trader, False if the user is a liquidity provider
    /// @return Withdrawn Amount. Might not be 18 decimals
    function withdrawAll(
        uint256 idx,
        address user,
        IERC20 withdrawToken,
        bool isTrader
    ) external override onlyClearingHouse returns (uint256) {
        int256 fullAmount = isTrader ? traderBalances[idx][user] : lpBalances[idx][user];
        return withdraw(idx, user, fullAmount.toUint256(), withdrawToken, isTrader);
    }

    /// @notice Withdraw share of tokens from account
    /// @param idx Index of the perpetual market
    /// @param user Account to withdraw from
    /// @param withdrawToken Token to be withdrawn from the vault
    /// @param reductionRatio Share of collateral to be withdrawn. Min: 0. Max: 1e18
    /// @param isTrader True if the user is a trader, False if the user is a liquidity provider
    /// @return Withdrawn Amount. Might not be 18 decimals
    function withdrawPartial(
        uint256 idx,
        address user,
        IERC20 withdrawToken,
        uint256 reductionRatio,
        bool isTrader
    ) external override onlyClearingHouse returns (uint256) {
        require(reductionRatio <= 1e18, "ReductionRatio must smaller than 1e18");
        int256 fullAmount = isTrader ? traderBalances[idx][user] : lpBalances[idx][user];
        int256 partialAmount = fullAmount.wadMul(reductionRatio.toInt256());
        return withdraw(idx, user, partialAmount.toUint256(), withdrawToken, isTrader);
    }

    /// @notice Withdraw tokens from account
    /// @param idx Index of the perpetual market
    /// @param user Account to withdraw from
    /// @param wadAmount Amount to withdraw from the vault. 18 decimals
    /// @param withdrawToken Token to be withdrawn from the vault
    /// @param isTrader True if the user is a trader, False if the user is a liquidity provider
    /// @return Withdrawn Amount. Might not be 18 decimals
    function withdraw(
        uint256 idx,
        address user,
        uint256 wadAmount,
        IERC20 withdrawToken,
        bool isTrader
    ) public override onlyClearingHouse returns (uint256) {
        int256 balance = isTrader ? traderBalances[idx][user] : lpBalances[idx][user];
        require(wadAmount.toInt256() <= balance, "Not enough balance");
        require(withdrawToken == reserveToken, "Wrong token address");

        // decrement balance
        _changeBalance(idx, user, -wadAmount.toInt256(), isTrader);

        // Safemath will throw if tvl < wadAmount
        totalReserveToken -= wadAmount;

        // perform transfer
        uint256 tokenAmount = LibReserve.wadToToken(reserveTokenDecimals, wadAmount);
        if (withdrawToken.balanceOf(address(this)) < tokenAmount) {
            uint256 borrowedAmount = tokenAmount - withdrawToken.balanceOf(address(this));
            insurance.settleDebt(borrowedAmount);
            badDebt += borrowedAmount;
            emit BadDebtGenerated(idx, user, borrowedAmount);
        }
        IERC20(withdrawToken).safeTransfer(user, tokenAmount);

        // deposit must exceed 10
        int256 balanceAfter = isTrader ? traderBalances[idx][user] : lpBalances[idx][user];
        if (balanceAfter != 0) {
            require(balanceAfter >= MIN_DEPOSIT_AMOUNT, "MIN_DEPOSIT_AMOUNT");
        }

        emit ValueLockedChanged(totalReserveToken);

        return tokenAmount;
    }

    /// @notice Withdraw tokens from account
    /// @param idx Index of the perpetual market
    /// @param user Account to withdraw from
    /// @param wadAmount Amount to withdraw from the vault. 18 decimals
    /// @param isTrader True if the user is a trader, False if the user is a liquidity provider
    function settleProfit(
        uint256 idx,
        address user,
        int256 wadAmount,
        bool isTrader
    ) external override onlyClearingHouse {
        int256 settlement = wadAmount.wadDiv(_getAssetPrice());
        _changeBalance(idx, user, settlement, isTrader);
    }

    /* ****************** */
    /*     Governance     */
    /* ****************** */

    // TODO: Only set once
    function setClearingHouse(IClearingHouse newClearingHouse) external onlyOwner {
        require(address(newClearingHouse) != address(0), "ClearingHouse can not be zero address");
        clearingHouse = newClearingHouse;
        emit ClearingHouseChanged(newClearingHouse);
    }

    function setInsurance(IInsurance newInsurance) external onlyOwner {
        require(address(newInsurance) != address(0), "Insurance can not be zero address");
        insurance = newInsurance;
        emit InsuranceChanged(newInsurance);
    }

    function setMaxTVL(uint256 newMaxTVL) external onlyOwner {
        require(newMaxTVL > 0, "MaxTVL must be greater than 0");
        maxTVL = newMaxTVL;
        emit MaxTVLChanged(newMaxTVL);
    }

    /* ****************** */
    /*   User getter      */
    /* ****************** */

    /// @notice Get the balance of a trader, accounted for in USD. 18 decimals
    /// @param idx Perpetual market index
    /// @param user Trader address
    /// @return Trader balance in USDC
    function getTraderBalance(uint256 idx, address user) external view override returns (int256) {
        return traderBalances[idx][user];
    }

    /// @notice Get the balance of a liquidity provider,  accounted for in USD. 18 decimals
    /// @param idx Perpetual market index
    /// @return LP balance in USDC
    function getLpBalance(uint256 idx, address user) external view override returns (int256) {
        return lpBalances[idx][user];
    }

    /// @notice Get the collateral value of a trader, accounted for in USD. 18 decimals
    /// @param idx Perpetual market index
    /// @param account Trader address
    /// @return Trader balance in USD

    function getTraderReserveValue(uint256 idx, address account) external view override returns (int256) {
        return traderBalances[idx][account].wadMul(_getAssetPrice());
    }

    /// @notice Get the collateral value of a liquidity provider, accounted for in USD. 18 decimals
    /// @param idx Perpetual market index
    /// @param account Lp address
    /// @return Lp balance in USD
    function getLpReserveValue(uint256 idx, address account) external view override returns (int256) {
        return lpBalances[idx][account].wadMul(_getAssetPrice());
    }

    /* ****************** */
    /*   Global getter    */
    /* ****************** */

    /// @notice Get the number of decimals of the ERC20 token used in the vault
    /// @return Number of decimals of the ERC20 token used in the vault
    function getReserveTokenDecimals() external view override returns (uint256) {
        return reserveTokenDecimals;
    }

    /// @notice Get the amount of tokens borrowed by insurance (bad debt)
    /// @return Amount of tokens borrowed by insurance. 18 decimals
    function getBadDebt() external view override returns (uint256) {
        return badDebt;
    }

    /// @notice Get the total amount of tokens in the vault
    /// @return Total amount of USDC deposited. 18 decimals
    function getTotalReserveToken() external view override returns (uint256) {
        return totalReserveToken;
    }

    /// @notice Get the maximum TVL set for the vault
    /// @return Maximum TVL set. 18 decimals
    function getMaxTVL() external view override returns (uint256) {
        return maxTVL;
    }

    /* ****************** */
    /*   Internal Fcts    */
    /* ****************** */

    /// @notice get the price of an asset
    function _getAssetPrice() internal pure returns (int256) {
        return 1e18;
    }

    function _changeBalance(
        uint256 idx,
        address user,
        int256 amount,
        bool isTrader
    ) internal {
        if (isTrader) {
            traderBalances[idx][user] += amount;
        } else {
            lpBalances[idx][user] += amount;
        }
    }
}
