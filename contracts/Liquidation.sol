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
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Liquidation is ILiquidation, Ownable {
    /// @notice Margin ratio for safe liquidation
    int256 immutable maxMarginSafeLiquidate;
    /// @notice Margin ratio for full liquidation
    int256 immutable maxMarginFullLiquidate;
    /// @notice Register perpetuals in Liquidation contract
    mapping(IPerpetual => bool) isPerpetual;

    constructor(int256 _maxMarginSafeLiquidate, int256 _maxMarginFullLiquidate) {
        maxMarginSafeLiquidate = _maxMarginSafeLiquidate;
        maxMarginFullLiquidate = _maxMarginFullLiquidate;
    }

    /// @notice Register perpetual market liquidation contract
    function whiteListPerpetualMarket(IPerpetual perpetualMarket) external override onlyOwner {
        isPerpetual[perpetualMarket] = true;
    }

    function liquidate(address account, IPerpetual perpetual) external override {
        require(isPerpetual[perpetual], "No perpetual market");
        // open position
        LibPerpetual.TraderPosition memory position = perpetual.getUserPosition(account);
        // vault contract used
        IVault userVault = perpetual.getVault(account);
        // user collateral
        int256 margin = userVault.getReserveValue(account);

        // find under which conditions an position would be liquidated
        int256 unrealizedPnl = 0;
        int256 marginRatio = LibMath.div(margin + unrealizedPnl, position.notional);
    }
}
