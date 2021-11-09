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

    function getVault(address _account) external override returns (IVault) {
        vaultUsed[_account];
    }

    // function getUserPosition(address account) external view override returns (LibPerpetual.TraderPosition memory) {
    //     return userPosition[account];
    // }

    // function getGlobalPosition() external view override returns (LibPerpetual.GlobalPosition memory) {
    //     return globalPosition;
    // }

    // functions
    function setPrice(LibPerpetual.Price memory newPrice) external override {
        prices.push(newPrice);
    }

    function setVault(address _account, IVault _vault) external override {
        vaultUsed[_account] = _vault;
    }

    // missing implementation
    function calcUnrealizedFundingPayments(address account) external view override returns (uint256) {}

    function mintLongPosition(uint256 amount) external view override returns (uint256) {}

    function redeemLongPosition(uint256 amount) external view override returns (uint256) {}

    function mintShortPosition(uint256 amount) external view override returns (uint256) {}

    function redeemShortPosition(uint256 amount) external view override returns (uint256) {}

    function settle(address account) external override {
        LibPerpetual.TraderPosition memory user = userPosition[account];
        LibPerpetual.GlobalPosition memory global = globalPosition;
        if (user.notional == 0) {
            // update user to global state when position is zero
            userPosition[account].timestamp = global.timestamp;
            userPosition[account].cumFundingRate = global.cumFundingRate
        } else if (user.timeStamp < global.timeStamp) {
            // update user variables when position opened before last update

            /* Funding rates (as defined in our protocol) are paid from shorts to longs

            case 1: user is long => has missed receiving funding payments (positive or negative)
            case 2: user is short => has missed making funding payments (positive or negative)

            comment: Making an negative funding payment is equvalent to receiving a positive one.
             */

            int256 upcomingFundingRate = 0;
            int256 upcomingFundingPayment = 0;
            if (user.cumFundingRate != global.cumFundingRate) {
                if (user.side = LibPerpetual.Side.Long) {
                    upcomingFundingRate = global.cumFundingRate - user.cumFundingRate;
                } else {
                    upcomingFundingRate = user.cumFundingRate - global.cumFundingRate;
                }
            upcomingFundingPayment = upcomingFundingRate * user.notional;
            }

            // get user vault
            IVault userVault = perpetual.getVault(account);
            userVault.applyFundingPayment(account, upcomingFundingPayment);
        }


            // update user variables to global state
            userPosition[account].timestamp = global.timestamp;
            userPosition[account].cumFundingRate = global.cumFundingRate
        }
    }

    function marginIsValid(address account) external view override returns (bool) {}
}
