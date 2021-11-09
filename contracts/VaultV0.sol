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
import {IERC20} from "./interfaces/IERC20.sol";

// dependencies
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// libraries
import {LibReserve} from "./lib/LibReserve.sol";
import {LibMath} from "./lib/LibMath.sol";

// toD0: use stable ERC20 implementation

contract VaultV0 is IVault {
    using LibMath for uint256;
    using LibMath for int256;
    // constants
    uint256 public constant MAX_DECIMALS = 18;
    uint256 private immutable reserveTokenDecimals;

    // dependent contracts
    //IInsurance private immutable insurance; // @dev Insurance address might not be needed
    IPerpetual private immutable perpetual;
    ILiquidation private immutable liquidation;
    IOracle private immutable oracle;
    IERC20 private immutable reserveToken;

    // deposit amount
    mapping(address => int256) private balances;
    uint256 public totalReserveToken;

    //      amm     =>         trader =>            ERC20 => balances
    // mapping(address => mapping(address => mapping(address => int256))) private balancesNested;

    constructor(
        address _perpetual,
        //address _insurance,
        address _liquidation,
        address _oracle,
        address _reserveToken
    ) {
        require(_perpetual != address(0), "Perpetual can not be zero address");
        require(_liquidation != address(0), "Liquidation can not be zero address");
        require(_oracle != address(0), "Oracle can not be zero address");
        require(_reserveToken != address(0), "Token can not be zero address");
        require(IERC20Decimals(_reserveToken).decimals() <= MAX_DECIMALS, "Has to have less than 18 decimals");

        // set contract addresses
        perpetual = IPerpetual(_perpetual);
        //insurance = IInsurance(_insurance);
        liquidation = ILiquidation(_liquidation);
        oracle = IOracle(_oracle);
        reserveToken = IERC20(_reserveToken);

        // set other parameters
        reserveTokenDecimals = IERC20Decimals(_reserveToken).decimals();
    }

    /************************* functions *************************/

    /**
     * @notice Deposit reserveTokens to account
     * @param  amount  Amount of reserveTokens with 18 decimals
     * @param  depositToken Token address deposited (used for backwards compatability)
     */
    // toDO: only check the amount which was deposited (https://youtu.be/6GaCt_lM_ak?t=1200)
    function deposit(uint256 amount, address depositToken) public override {
        require(depositToken == address(reserveToken));
        perpetual.settle(msg.sender);

        // deposit reserveTokens to contract

        // convert to decimals amount
        // convert the WAD amount to the correct token amount to transfer
        // cast is safe since amount is a uint, and wadToToken can only
        // scale down the value
        uint256 rawTokenAmount = uint256(LibReserve.wadToToken(reserveTokenDecimals, amount).toInt256());
        require(IERC20(depositToken).transferFrom(msg.sender, address(this), rawTokenAmount), "TCR: Transfer failed");

        // this prevents dust from being added to the user account
        // eg 10^18 -> 10^8 -> 10^18 will remove lower order bits
        int256 convertedWadAmount = LibReserve.tokenToWad(reserveTokenDecimals, rawTokenAmount);

        // increment balance
        balances[msg.sender] += convertedWadAmount;
        totalReserveToken += amount;

        emit Deposit(msg.sender, depositToken, amount);
    }

    /**
     * @notice Withdraw ERC20 reserveToken from margin of the contract account.
     * @param withdrawToken ERC20 reserveToken address
     * @param  amount  Amount of USDC deposited
     */
    function withdraw(uint256 amount, address withdrawToken) public override {
        require(withdrawToken == address(reserveToken));
        perpetual.settle(msg.sender);

        uint256 rawTokenAmount = LibReserve.wadToToken(reserveTokenDecimals, amount);
        int256 convertedWadAmount = LibReserve.tokenToWad(reserveTokenDecimals, rawTokenAmount);

        balances[msg.sender] -= convertedWadAmount;

        // this may be able to be optimised
        require(perpetual.marginIsValid(msg.sender));

        // Safemath will throw if tvl < amount
        totalReserveToken -= uint256(convertedWadAmount);

        // perform transfer
        require(IERC20(withdrawToken).transfer(msg.sender, rawTokenAmount), "TCR: Transfer failed");

        emit Withdraw(msg.sender, withdrawToken, amount);
    }

    /**
     * @notice get the Portfolio value of an account
     * @param _account Account address
     */
    function getReserveValue(address _account) external view override returns (int256) {
        return getAssetValue(_account, address(reserveToken));
    }

    /**
     * @notice get the Asset value of some asset of an account
     *  @param _account Account address
     *  @param _asset Asset address
     */
    function getAssetValue(address _account, address _asset) public view override returns (int256) {
        int256 accountBalance = balances[_account];
        int256 price = oracle.getAssetPrice(_asset);
        return accountBalance * price;
    }

    function applyFundingPayment(address account, int256 upcomingFundingPayment) {}
}
