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
    uint256 internal constant MAX_DECIMALS = 18;
    uint256 internal immutable reserveTokenDecimals;

    // state
    IInsurance public immutable override insurance;
    IERC20 public immutable override reserveToken;
    IClearingHouse public override clearingHouse;

    uint256 internal totalReserveToken;
    uint256 internal badDebt;
    mapping(uint256 => mapping(address => int256)) private balances;

    //      trader     =>      market  => balances

    constructor(IERC20 _reserveToken, IInsurance _insurance) {
        require(address(_reserveToken) != address(0), "Token can not be zero address");
        require(
            IERC20Decimals(address(_reserveToken)).decimals() <= MAX_DECIMALS,
            "Has to have not more than 18 decimals"
        );
        require(address(_insurance) != address(0), "Insurance can not be zero address");

        // set contract addresses
        reserveToken = _reserveToken;
        insurance = _insurance;

        // set other parameters
        reserveTokenDecimals = IERC20Decimals(address(_reserveToken)).decimals();
    }

    /************************* getter *************************/

    function getBalance(uint256 idx, address user) external view override returns (int256) {
        return balances[idx][user];
    }

    /************************* functions *************************/

    modifier onlyClearingHouse() {
        require(msg.sender == address(clearingHouse), "NO CLEARINGHOUSE");
        _;
    }

    // TODO: Only set once
    function setClearingHouse(IClearingHouse newClearingHouse) external onlyOwner {
        require(address(newClearingHouse) != address(0), "ClearingHouse can not be zero address");
        clearingHouse = newClearingHouse;
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
        IERC20 depositToken
    ) external override onlyClearingHouse returns (uint256) {
        require(depositToken == reserveToken, "Wrong token");

        // this prevents dust from being added to the user account
        // eg 10^18 -> 10^8 -> 10^18 will remove lower order bits
        uint256 convertedWadAmount = LibReserve.tokenToWad(reserveTokenDecimals, amount);

        // increment balance
        balances[idx][user] += convertedWadAmount.toInt256();
        totalReserveToken += convertedWadAmount;

        // deposit reserveTokens to contract
        IERC20(depositToken).safeTransferFrom(user, address(this), amount);

        return convertedWadAmount;
    }

    /**
     * @notice Withdraw all ERC20 reserveToken from margin of the contract account.
     * @param withdrawToken ERC20 reserveToken address
     */
    function withdrawAll(
        uint256 idx,
        address user,
        IERC20 withdrawToken
    ) external override onlyClearingHouse returns (uint256) {
        return withdraw(idx, user, balances[idx][user].toUint256(), withdrawToken);
    }

    /**
     * @notice Withdraw ERC20 reserveToken from margin of the contract account.
     * @param withdrawToken ERC20 reserveToken address
     * @param  amount  Amount of USDC deposited
     */
    function withdraw(
        uint256 idx,
        address user,
        uint256 amount,
        IERC20 withdrawToken
    ) public override onlyClearingHouse returns (uint256) {
        require(amount.toInt256() <= balances[idx][user], "Not enough balance");
        require(withdrawToken == reserveToken, "Wrong token address");

        //    console.log("hardhat: Withdrawing for user", amount);

        uint256 rawTokenAmount = LibReserve.wadToToken(reserveTokenDecimals, amount);

        balances[idx][user] -= amount.toInt256();
        // Safemath will throw if tvl < amount
        totalReserveToken -= amount;

        //    console.log("Withdrawing for user (raw)", rawTokenAmount);
        // perform transfer
        if (withdrawToken.balanceOf(address(this)) < rawTokenAmount) {
            uint256 borrowedAmount = rawTokenAmount - withdrawToken.balanceOf(address(this));
            insurance.settleDebt(borrowedAmount);
            badDebt += borrowedAmount;
            emit BadDebtGenerated(0, user, borrowedAmount);
        }
        IERC20(withdrawToken).safeTransfer(user, rawTokenAmount);

        return rawTokenAmount;
    }

    function settleProfit(
        uint256 idx,
        address user,
        int256 amount
    ) external override onlyClearingHouse {
        //console.log("hardhat: amount", amount > 0 ? amount.toUint256() : (-1 * amount).toUint256());
        int256 settlement = LibMath.wadDiv(amount, getAssetPrice());
        balances[idx][user] += settlement;
    }

    /**
     * @notice get the Portfolio value of an account
     * @param account Account address
     */
    function getReserveValue(uint256 idx, address account) external view override returns (int256) {
        return PRBMathSD59x18.mul(balances[idx][account], getAssetPrice());
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
        return badDebt;
    }
}
