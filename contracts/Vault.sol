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

/// @dev Vault must be called right after Perpetual is deployed to set Perpetual as the owner of the contract
contract Vault is IVault, Context, IncreOwnable {
    using SafeERC20 for IERC20;
    using LibMath for uint256;
    using LibMath for int256;

    // constants
    int256 internal constant MIN_DEPOSIT_AMOUNT = 10e18; // min deposit of 10
    uint256 internal constant MAX_DECIMALS = 18;
    uint256 internal immutable reserveTokenDecimals;

    // state
    IERC20 public immutable override reserveToken;
    IClearingHouse public override clearingHouse;
    IInsurance public override insurance;

    uint256 internal badDebt;
    uint256 internal maxTVL;

    /* Balances of users and liquidity providers

    We follow a strict separate margin design where have to deposit collateral for any market

    There exists two balances with a special type of meaning:

    traderBalances[0][clearingHouse.address] := insurance reserve of the protocol
    traderBalances[1][clearingHouse.address] := profit earned by governance from selling dust

            market     =>      trader  => balance
    */
    mapping(uint256 => mapping(address => int256)) private traderBalances;
    mapping(uint256 => mapping(address => int256)) private lpBalances;

    uint256 internal totalReserveToken;

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

    /************************* governance *************************/

    modifier onlyClearingHouse() {
        require(msg.sender == address(clearingHouse), "NO CLEARINGHOUSE");
        _;
    }

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

    /**
     * @notice Deposit reserveTokens to account
     * @param  amount  Amount of reserveTokens with token decimals
     * @param  depositToken Token address deposited (used for backwards compatibility)
     */
    // toDO: only check the amount which was deposited (https://youtu.be/6GaCt_lM_ak?t=1200)
    function deposit(
        uint256 idx,
        address user,
        uint256 amount,
        IERC20 depositToken,
        bool isTrader
    ) external override onlyClearingHouse returns (uint256) {
        require(depositToken == reserveToken, "Wrong token");

        uint256 convertedWadAmount = LibReserve.tokenToWad(reserveTokenDecimals, amount);

        // deposit must exceed 10
        require(convertedWadAmount.toInt256() >= MIN_DEPOSIT_AMOUNT, "MIN_DEPOSIT_AMOUNT");

        // increment balance
        _changeBalance(idx, user, convertedWadAmount.toInt256(), isTrader);
        totalReserveToken += convertedWadAmount;

        require(totalReserveToken <= maxTVL, "MAX_TVL");

        // deposit reserveTokens to contract
        IERC20(depositToken).safeTransferFrom(user, address(this), amount);

        emit ValueLockedChanged(totalReserveToken);

        return convertedWadAmount;
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

    /**
     * @notice Withdraw all ERC20 reserveToken from margin of the contract account.
     * @param withdrawToken ERC20 reserveToken address
     */
    function withdrawAll(
        uint256 idx,
        address user,
        IERC20 withdrawToken,
        bool isTrader
    ) external override onlyClearingHouse returns (uint256) {
        int256 fullAmount = isTrader ? traderBalances[idx][user] : lpBalances[idx][user];
        return withdraw(idx, user, fullAmount.toUint256(), withdrawToken, isTrader);
    }

    function withdrawPartial(
        uint256 idx,
        address user,
        IERC20 withdrawToken,
        uint256 reductionRatio,
        bool isTrader
    ) external override onlyClearingHouse returns (uint256) {
        int256 fullAmount = isTrader ? traderBalances[idx][user] : lpBalances[idx][user];
        int256 partialAmount = fullAmount.wadMul(reductionRatio.toInt256());
        return withdraw(idx, user, partialAmount.toUint256(), withdrawToken, isTrader);
    }

    /**
     * @notice Withdraw ERC20 reserveToken from margin of the contract account.
     * @param withdrawToken ERC20 reserveToken address
     * @param amount Collateral amount to withdraw. Must be 18 decimals
     */
    function withdraw(
        uint256 idx,
        address user,
        uint256 amount,
        IERC20 withdrawToken,
        bool isTrader
    ) public override onlyClearingHouse returns (uint256) {
        int256 balance = isTrader ? traderBalances[idx][user] : lpBalances[idx][user];
        require(amount.toInt256() <= balance, "Not enough balance");
        require(withdrawToken == reserveToken, "Wrong token address");

        // decrement balance
        _changeBalance(idx, user, -amount.toInt256(), isTrader);

        // Safemath will throw if tvl < amount
        totalReserveToken -= amount;

        // perform transfer
        uint256 rawTokenAmount = LibReserve.wadToToken(reserveTokenDecimals, amount);
        if (withdrawToken.balanceOf(address(this)) < rawTokenAmount) {
            uint256 borrowedAmount = rawTokenAmount - withdrawToken.balanceOf(address(this));
            insurance.settleDebt(borrowedAmount);
            badDebt += borrowedAmount;
            emit BadDebtGenerated(0, user, borrowedAmount);
        }
        IERC20(withdrawToken).safeTransfer(user, rawTokenAmount);

        // deposit must exceed 10
        int256 balanceAfter = isTrader ? traderBalances[idx][user] : lpBalances[idx][user];
        if (balanceAfter != 0) {
            require(balanceAfter >= MIN_DEPOSIT_AMOUNT, "MIN_DEPOSIT_AMOUNT");
        }

        emit ValueLockedChanged(totalReserveToken);

        return rawTokenAmount;
    }

    /// @param amount Must be 18 decimals
    function settleProfit(
        uint256 idx,
        address user,
        int256 amount,
        bool isTrader
    ) external override onlyClearingHouse {
        int256 settlement = amount.wadDiv(getAssetPrice());
        _changeBalance(idx, user, settlement, isTrader);
    }

    /************************* getter *************************/

    function getTraderBalance(uint256 idx, address user) external view override returns (int256) {
        return traderBalances[idx][user];
    }

    function getLpBalance(uint256 idx, address user) external view override returns (int256) {
        return lpBalances[idx][user];
    }

    /**
     * @notice Get the value of a balance, accounted for in USD (with 18 decimals)
     * @param idx Perpetual market index
     * @param account Account address
     */
    function getTraderReserveValue(uint256 idx, address account) external view override returns (int256) {
        return traderBalances[idx][account].wadMul(getAssetPrice());
    }

    /**
     * @notice Get the value of a balance, accounted for in USD (with 18 decimals)
     * @param idx Perpetual market index
     * @param account Account address
     */
    function getLpReserveValue(uint256 idx, address account) external view override returns (int256) {
        return lpBalances[idx][account].wadMul(getAssetPrice());
    }

    /**
     * @notice get the number of decimals of the ERC20 token used in the vault
     */
    function getReserveTokenDecimals() external view override returns (uint256) {
        return reserveTokenDecimals;
    }

    /**
     * @notice get the price of an asset
     */
    function getAssetPrice() public pure returns (int256) {
        return 1e18;
    }

    function getBadDebt() external view override returns (uint256) {
        return badDebt;
    }

    function getTotalReserveToken() external view override returns (uint256) {
        return totalReserveToken;
    }

    function getMaxTVL() external view override returns (uint256) {
        return maxTVL;
    }
}
