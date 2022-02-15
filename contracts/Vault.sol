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
import {IPerpetual} from "./interfaces/IPerpetual.sol";

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
    uint256 private immutable reserveTokenDecimals;

    // state
    IChainlinkOracle public immutable override chainlinkOracle;
    IERC20 public immutable override reserveToken;
    uint256 public override totalReserveToken;

    //      trader     =>      market  => balances
    mapping(address => mapping(IPerpetual => int256)) private balances;

    // allow listed markets
    mapping(IPerpetual => bool) private allowListedMarkets;

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

    function getBalance(address user, IPerpetual market) external view override returns (int256) {
        return balances[user][market];
    }

    /************************* functions *************************/

    modifier onlyPerpetual() {
        require(allowListedMarkets[IPerpetual(msg.sender)], "NOT_PERPETUAL");
        _;
    }

    function isAllowListed(IPerpetual market) external view override returns (bool) {
        return allowListedMarkets[market];
    }

    function addMarket(IPerpetual market) external override onlyOwner {
        require(!allowListedMarkets[market]);
        allowListedMarkets[market] = true;

        emit MarketAdded(market);
    }

    /**
     * @notice Deposit reserveTokens to account
     * @param  amount  Amount of reserveTokens with token decimals
     * @param  depositToken Token address deposited (used for backwards compatibility)
     */
    // toDO: only check the amount which was deposited (https://youtu.be/6GaCt_lM_ak?t=1200)
    function deposit(
        address user,
        uint256 amount,
        IERC20 depositToken
    ) external override onlyPerpetual returns (uint256) {
        require(depositToken == reserveToken, "Wrong token");

        // this prevents dust from being added to the user account
        // eg 10^18 -> 10^8 -> 10^18 will remove lower order bits
        uint256 convertedWadAmount = LibReserve.tokenToWad(reserveTokenDecimals, amount);

        // increment balance
        balances[user][IPerpetual(msg.sender)] += convertedWadAmount.toInt256();
        totalReserveToken += convertedWadAmount;

        // deposit reserveTokens to contract
        IERC20(depositToken).safeTransferFrom(user, address(this), amount);

        return convertedWadAmount;
    }

    /**
     * @notice Withdraw all ERC20 reserveToken from margin of the contract account.
     * @param withdrawToken ERC20 reserveToken address
     */
    function withdrawAll(address user, IERC20 withdrawToken) external override onlyPerpetual returns (uint256) {
        return withdraw(user, balances[user][IPerpetual(msg.sender)].toUint256(), withdrawToken);
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
    ) public override onlyPerpetual returns (uint256) {
        require(amount.toInt256() <= balances[user][IPerpetual(msg.sender)], "Not enough balance");
        require(withdrawToken == reserveToken, "Wrong token address");

        //    console.log("hardhat: Withdrawing for user", amount);

        uint256 rawTokenAmount = LibReserve.wadToToken(reserveTokenDecimals, amount);

        balances[user][IPerpetual(msg.sender)] -= amount.toInt256();
        // Safemath will throw if tvl < amount
        totalReserveToken -= amount;

        //    console.log("Withdrawing for user (raw)", rawTokenAmount);
        // perform transfer
        IERC20(withdrawToken).safeTransfer(user, rawTokenAmount);

        return rawTokenAmount;
    }

    /**
     * @notice get the Portfolio value of an account
     * @param account Account address
     */
    function getReserveValue(address account, IPerpetual market) external view override returns (int256) {
        return PRBMathSD59x18.mul(balances[account][market], getAssetPrice());
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

    function settleProfit(address user, int256 amount) external override onlyPerpetual {
        //console.log("hardhat: amount", amount > 0 ? amount.toUint256() : (-1 * amount).toUint256());
        int256 settlement = LibMath.wadDiv(amount, getAssetPrice());
        balances[user][IPerpetual(msg.sender)] += settlement;
    }
}
