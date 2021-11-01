// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";

import {LibPerpetual} from "./lib/LibPerpetual.sol";

contract Perpetual is IPerpetual {
    event LogFundingPayment(uint256 indexed blockNumber, uint256 value, bool isPositive);

    LibPerpetual.Price[] public prices;
    mapping(address => LibPerpetual.TraderPosition) userPosition;
    LibPerpetual.GlobalPosition public globalPosition;
    mapping(address => IVault) vaultUsed;

    // viewer function
    function getLatestPrice() public view override returns (LibPerpetual.Price memory) {
        return getPrice(prices.length - 1);
    }

    function getPrice(uint256 _period) public view override returns (LibPerpetual.Price memory) {
        return prices[_period];
    }

    // functions
    function setPrice(LibPerpetual.Price memory newPrice) external override {
        prices.push(newPrice);
    }

    function setVault(address _account, IVault _vault) external override {
        vaultUsed[_account] = _vault;
    }

    function getVault(address _account) external override returns (IVault) {
        vaultUsed[_account];
    }

    function getUserPosition(address account) external view override returns (LibPerpetual.TraderPosition memory) {
        return userPosition[account];
    }

    function getGlobalPosition() external view override returns (LibPerpetual.GlobalPosition memory) {
        return globalPosition;
    }

    // missing implementation
    function mintLongPosition(uint256 amount) external view override returns (uint256) {}

    function redeemLongPosition(uint256 amount) external view override returns (uint256) {}

    function mintShortPosition(uint256 amount) external view override returns (uint256) {}

    function redeemShortPosition(uint256 amount) external view override returns (uint256) {}

    function settle(address account) external override {}

    function marginIsValid(address account) external view override returns (bool) {}
}
