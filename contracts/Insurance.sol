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

    constructor(IERC20 _token, IVault _vault) {
        require(address(_token) != address(0), "Token zero address");
        require(address(_vault) != address(0), "Vault zero address");
        token = _token;
        vault = _vault;
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
    }

    function withdrawRemainder() external override onlyOwner {
        uint256 remainingBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(msg.sender, remainingBalance);

        emit LiquidityWithdrawn(remainingBalance);
    }
}
