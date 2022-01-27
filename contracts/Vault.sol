// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// contracts
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {PRBMathSD59x18} from "prb-math/contracts/PRBMathSD59x18.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IncreOwnable} from "./utils/IncreOwnable.sol";

// interfaces
import {IInsurance} from "./interfaces/IInsurance.sol";
import {ILiquidation} from "./interfaces/ILiquidation.sol";
import {IChainlinkOracle} from "./interfaces/IChainlinkOracle.sol";
import {IVault} from "./interfaces/IVault.sol";
import {IERC20Decimals} from "./interfaces/IERC20Decimals.sol";

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
    uint256 private constant MAX_DECIMALS = 18;
    uint256 private constant ONE = 1e18;
    address private constant NO_ORACLE = 0x496E6372656d656E740000000000000000000000; /// 'Increment'
    uint256 private immutable reserveTokenDecimals;

    // state
    IChainlinkOracle public immutable override chainlinkOracle;
    IERC20 public immutable override reserveToken;
    uint256 public override totalReserveToken;
    //      amm     =>         trader =>            ERC20 => balances
    // mapping(address => mapping(address => mapping(address => int256))) private balancesNested;
    mapping(address => int256) private balances;

    constructor(IChainlinkOracle _chainlinkOracle, IERC20 _reserveToken) {
        require(address(_chainlinkOracle) != address(0), "ChainlinkOracle can not be zero address");
        require(address(_reserveToken) != address(0), "Token can not be zero address");
        require(
            IERC20Decimals(address(_reserveToken)).decimals() <= MAX_DECIMALS,
            "Has to have not more than 18 decimals"
        );

        // set contract addresses
        chainlinkOracle = _chainlinkOracle;
        reserveToken = _reserveToken;

        // set other parameters
        reserveTokenDecimals = IERC20Decimals(address(_reserveToken)).decimals();
    }

    /************************* getter *************************/

    function getBalance(address user) public view returns (int256) {
        return balances[user];
    }

    /************************* functions *************************/

    /**
     * @notice Deposit reserveTokens to account
     * @param  amount  Amount of reserveTokens with token decimals
     * @param  depositToken Token address deposited (used for backwards compatability)
     */
    // toDO: only check the amount which was deposited (https://youtu.be/6GaCt_lM_ak?t=1200)
    function deposit(
        address user,
        uint256 amount,
        IERC20 depositToken
    ) external override onlyOwner returns (uint256) {
        require(depositToken == reserveToken, "Wrong token");

        // deposit reserveTokens to contract
        IERC20(depositToken).safeTransferFrom(user, address(this), amount);
        // this prevents dust from being added to the user account
        // eg 10^18 -> 10^8 -> 10^18 will remove lower order bits
        uint256 convertedWadAmount = LibReserve.tokenToWad(reserveTokenDecimals, amount);

        // increment balance
        balances[user] += convertedWadAmount.toInt256();
        totalReserveToken += convertedWadAmount;

        return convertedWadAmount;
    }

    /**
     * @notice Withdraw all ERC20 reserveToken from margin of the contract account.
     * @param withdrawToken ERC20 reserveToken address
     */
    function withdrawAll(address user, IERC20 withdrawToken) external override onlyOwner returns (uint256) {
        return withdraw(user, balances[user].toUint256(), withdrawToken);
    }

    /**
     * @notice Withdraw ERC20 reserveToken from margin of the contract account.
     * @param withdrawToken ERC20 reserveToken address
     * @param  amount  Amount of USDC deposited
     */
    function withdraw(
        address user,
        uint256 amount,
        IERC20 withdrawToken
    ) public override onlyOwner returns (uint256) {
        require(amount.toInt256() <= balances[user], "Not enough balance");
        require(withdrawToken == reserveToken, "Wrong token address");

        uint256 rawTokenAmount = LibReserve.wadToToken(reserveTokenDecimals, amount);
        balances[user] -= amount.toInt256();
        // Safemath will throw if tvl < amount
        totalReserveToken -= amount;

        // console.log(
        //     "hardhat: balances[user]",
        //     balances[user] > 0 ? balances[user].toUint256() : (-1 * balances[user]).toUint256()
        // );
        // perform transfer
        IERC20(withdrawToken).safeTransfer(user, rawTokenAmount);
        return rawTokenAmount;
    }

    /**
     * @notice get the Portfolio value of an account
     * @param _account Account address
     */
    function getReserveValue(address _account) external view override returns (int256) {
        return PRBMathSD59x18.mul(balances[_account], getAssetPrice());
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

    function settleProfit(address user, int256 amount) public override onlyOwner returns (int256) {
        //console.log("hardhat: amount", amount > 0 ? amount.toUint256() : (-1 * amount).toUint256());
        int256 settlement = LibMath.wadDiv(amount, getAssetPrice());
        balances[user] += settlement;
        return settlement;
    }
}
