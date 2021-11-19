// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

// perpetual contracts
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IInsurance} from "./interfaces/IInsurance.sol";
import {ILiquidation} from "./interfaces/ILiquidation.sol";
import {IOracle} from "./interfaces/IOracle.sol";
import {IVault} from "./interfaces/IVault.sol";

// token information
import {IERC20Decimals} from "./interfaces/IERC20Decimals.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// dependencies
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {PRBMathSD59x18} from "prb-math/contracts/PRBMathSD59x18.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";

// libraries
import {LibReserve} from "./lib/LibReserve.sol";
import {LibMath} from "./lib/LibMath.sol";

// toD0: use stable ERC20 implementation
import "hardhat/console.sol";

contract Vault is IVault, Context {
    using SafeERC20 for IERC20;
    using LibMath for uint256;
    using LibMath for int256;
    // constants
    uint256 private constant MAX_DECIMALS = 18;
    uint256 private constant ONE = 1e18;
    address private constant NO_ORACLE = 0x496E6372656d656E740000000000000000000000; /// 'Increment'
    uint256 private immutable reserveTokenDecimals;

    // state
    IPerpetual private immutable perpetual;
    // IOracle private immutable oracle;
    IERC20 private immutable reserveToken;
    uint256 private totalReserveToken;
    //      amm     =>         trader =>            ERC20 => balances
    // mapping(address => mapping(address => mapping(address => int256))) private balancesNested;
    mapping(address => int256) private balances;

    constructor(
        address _perpetual,
        // address _oracle,
        address _reserveToken
    ) {
        require(_perpetual != address(0), "Perpetual can not be zero address");
        // require(_oracle != address(0), "Oracle can not be zero address");
        require(_reserveToken != address(0), "Token can not be zero address");
        require(IERC20Decimals(_reserveToken).decimals() <= MAX_DECIMALS, "Has to have less than 18 decimals");

        // set contract addresses
        perpetual = IPerpetual(_perpetual);
        // oracle = IOracle(_oracle);
        reserveToken = IERC20(_reserveToken);

        // set other parameters
        reserveTokenDecimals = IERC20Decimals(_reserveToken).decimals();
    }

    /************************* modifiers *************************/
    modifier onlyPerpetual() {
        require(_msgSender() == address(perpetual), "Only Perpetual can call this function");
        _;
    }

    /************************* getter *************************/

    function getPerpetual() public view returns (address) {
        return address(perpetual);
    }

    function getReserveToken() public view returns (address) {
        return address(reserveToken);
    }

    function getTotalReserveToken() public view returns (uint256) {
        return totalReserveToken;
    }

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
    ) external override onlyPerpetual {
        require(depositToken == reserveToken, "Wrong token");

        // deposit reserveTokens to contract
        IERC20(depositToken).safeTransferFrom(user, address(this), amount);
        // this prevents dust from being added to the user account
        // eg 10^18 -> 10^8 -> 10^18 will remove lower order bits
        int256 convertedWadAmount = LibReserve.tokenToWad(reserveTokenDecimals, amount);

        // increment balance
        balances[user] += convertedWadAmount;
        totalReserveToken += convertedWadAmount.toUint256();
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
    ) external override onlyPerpetual {
        require(amount.toInt256() <= balances[user], "Not enough balance");
        require(withdrawToken == reserveToken, "Wrong token address");

        uint256 rawTokenAmount = LibReserve.wadToToken(reserveTokenDecimals, amount);
        balances[user] -= amount.toInt256();
        // Safemath will throw if tvl < amount
        totalReserveToken -= amount;
        // perform transfer
        IERC20(withdrawToken).safeTransfer(user, rawTokenAmount);
    }

    /**
     * @notice get the Portfolio value of an account
     * @param _account Account address
     */
    function getReserveValue(address _account) external view override returns (int256) {
        return PRBMathSD59x18.mul(balances[_account], getAssetPrice());
    }

    /**
     * @notice get the price of an asset
     */
    function getAssetPrice() public pure returns (int256) {
        return 1e18;
    }

    function settleProfit(address user, int256 amount) public override onlyPerpetual returns (int256) {
        int256 settlement = LibMath.div(amount, getAssetPrice());
        balances[user] += settlement;
        return settlement;
    }
}
