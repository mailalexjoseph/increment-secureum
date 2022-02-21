// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IncreOwnable} from "./utils/IncreOwnable.sol";

// interfaces
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVault} from "./interfaces/IVault.sol";
import {IInsurance} from "./interfaces/IInsurance.sol";

contract Insurance is IInsurance, IncreOwnable {
    using SafeERC20 for IERC20;

    IERC20 public token;
    IVault public vault;

    event DebtSettled(address indexed user, uint256 amount);
    event LiquidityWithdrawn(uint256 amount);
    event VaultChanged(IVault vault);

    constructor(IERC20 _token) {
        token = _token;
    }

    function setVault(IVault vault_) external onlyOwner {
        require(address(vault_) != address(0));
        vault = vault_;
        emit VaultChanged(vault_);
    }

    modifier onlyVault() {
        require(msg.sender == address(vault));
        _;
    }

    function settleDebt(uint256 amount) external override onlyVault {
        address caller = msg.sender;
        // only borrower

        require(IERC20(token).balanceOf(address(this)) >= amount, "Insufficient insurance balance");

        IERC20(token).safeTransfer(caller, amount);

        emit DebtSettled(caller, amount);
    }

    function withdrawRemainder() external override onlyOwner {
        uint256 remainingBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(msg.sender, remainingBalance);

        emit LiquidityWithdrawn(remainingBalance);
    }
}
