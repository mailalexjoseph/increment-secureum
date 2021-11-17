// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

// interfaces
import {ILiquidation} from "./interfaces/ILiquidation.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IPerpetual.sol";

// Library
import {LibPerpetual} from "./lib/LibPerpetual.sol";
import {LibMath} from "./lib/LibMath.sol";

// Dependencies
import {IncreOwnable} from "./utils/IncreOwnable.sol";

contract Liquidation is ILiquidation, IncreOwnable {
    /// @notice Margin ratio for full liquidation
    int256 constant minMargin = 25e15; // 2.5%
    /// @notice Liquidation fee
    int256 constant liquidationFee = 60e15; // 6%
    /// @notice Register perpetuals in Liquidation contract
    mapping(IPerpetual => bool) isPerpetual;

    constructor() {}

    /// @notice Register perpetual market liquidation contract
    function whiteListPerpetualMarket(IPerpetual perpetual) external override onlyOwner {
        require(address(perpetual) != address(0));
        isPerpetual[perpetual] = true;
    }

    // thats good: see (https://consensys.net/blog/developers/solidity-best-practices-for-smart-contract-security/)
    function liquidate(
        uint256 amount,
        address account,
        IPerpetual perpetual
    ) external override {
        require(isPerpetual[perpetual], "No perpetual market");

        // // get account open positions
        // LibPerpetual.TraderPosition memory position = perpetual.getUserPosition(account);

        // // close position
        // perpetual.closePosition(traderPosition.notional, position.side);
        // // get account collateral vault
        // IVault userVault = perpetual.getVault(account);

        // // find under which conditions an position would be liquidated
        // int256 margin = userVault.getReserveValue(account);
        // int256 unrealizedPnl = 0; /// toDO: unrealizedPnl = position.getUnrealizedPnl();
        // int256 fundingPayments = 0; /// doDo: fundingPayments = market.getFundingPayments(account);

        // // calculate margin ratio
        // int256 marginRatio = LibMath.div(margin + unrealizedPnl + fundingPayments, position.notional);

        // if (marginRatio < minMargin) {
        //     // toDo: calculate the margin before

        //     // calculate money left
        //     // calculate bad debt
        //     // (
        //     //     int256 liquidatorQuoteChange,
        //     //     int256 liquidatorBaseChange,
        //     //     int256 liquidateeQuoteChange,
        //     //     int256 liquidateeBaseChange
        //     // ) = LibLiquidation.liquidationBalanceChanges(
        //     //     liquidatedBalance.position.base,
        //     //     liquidatedBalance.position.quote,
        //     //     amount
        //     // );

        //     // perpetual.updatePositionOnLiquidation(
        //     //     msg.sender,
        //     //     account,
        //     //     liquidatorQuoteChange,
        //     //     liquidatorBaseChange,
        //     //     liquidateeQuoteChange,
        //     //     liquidateeBaseChange,
        //     //     amountToEscrow
        //     // );

        //     // userVault.updateVaultOnLiquidation(
        //     //     msg.sender,
        //     //     account,
        //     //     liquidatorQuoteChange,
        //     //     liquidatorBaseChange,
        //     //     liquidateeQuoteChange,
        //     //     liquidateeBaseChange,
        //     //     amountToEscrow
        //     // );

        //     emit LiquidationCall(address(perpetual), account, msg.sender, amount, block.timestamp);
        // } else {
        //     return;
        // }
    }
}
