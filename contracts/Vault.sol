// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {PTypes} from "./lib/PTypes.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";

// doDO: typecast numbers safely
// doDO: use stable ERC20 implementation

contract Vault is IVault {
    uint256 public constant maxDecimals = 18;

    IPerpetual private immutable perpetual;
    mapping(address => PTypes.Reserves) private balances;

    constructor(address _perpetual) {
        require(_perpetual != address(0), "Can not be zero address");
        perpetual = IPerpetual(_perpetual);
    }

    event Deposit(uint256 amount, address indexed user, address indexed asset);
    event Withdraw(int256 amount, address indexed user, address indexed asset);

    /************************* functions *************************/

    /**
     * @notice Deposit ERC20 token as margin to the contract account.
     * @param  _amount  Amount of USDC deposited
     */
    // toDO: only check the amount which was deposited (https://youtu.be/6GaCt_lM_ak?t=1200)
    function deposit(uint256 _amount, address _token) public {
        // deposit tokens to contract
        SafeERC20.safeTransferFrom(IERC20(_token), msg.sender, address(this), _amount);

        // convert to decimals amount
        uint256 tokenDecimals = IERC20Metadata(_token).decimals();
        require(tokenDecimals <= maxDecimals, "Has to have less than 18 decimals");
        uint256 amountWei = _amount * 10**(maxDecimals - tokenDecimals);

        // increment balance
        balances[msg.sender].userReserve[_token] += int256(amountWei);

        emit Deposit(_amount, msg.sender, _token);
    }

    /**
     * @notice Withdraw ERC20 token from margin of the contract account.
     * @param _token ERC20 token address
     * @param  _amount  Amount of USDC deposited
     */
    function withdraw(int256 _amount, address _token) public {
        require(_amount <= balances[msg.sender].userReserve[_token], "Can not require more than in balance");

        // decrement balance
        balances[msg.sender].userReserve[_token] -= _amount;

        // convert to decimals amount
        uint256 tokenDecimals = IERC20Metadata(_token).decimals();
        require(tokenDecimals <= maxDecimals, "Has to have less than 18 decimals");
        uint256 amountDecimals = uint256(_amount) / 10**(maxDecimals - tokenDecimals);

        // withdraw tokens to address
        SafeERC20.safeTransfer(IERC20(_token), msg.sender, amountDecimals);

        emit Withdraw(_amount, msg.sender, _token);
    }
}
