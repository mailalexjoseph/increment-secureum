// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.4;

// contracts
import {Perpetual} from "../Perpetual.sol";

// interfaces
import {ICryptoSwap} from "../interfaces/ICryptoSwap.sol";
import {IVBase} from "../interfaces/IVBase.sol";
import {IVQuote} from "../interfaces/IVQuote.sol";
import {IClearingHouse} from "../interfaces/IClearingHouse.sol";

// libraries
import {LibPerpetual} from "../lib/LibPerpetual.sol";

import "hardhat/console.sol";

/*
 * TestPerpetual includes some setter functions to edit part of
 * the internal state of Perpetual which aren't exposed otherwise.
 */
contract TestPerpetual is Perpetual {
    constructor(
        IVBase _vBase,
        IVQuote _vQuote,
        ICryptoSwap _curvePool,
        IClearingHouse _clearingHouse
    ) Perpetual(_vBase, _vQuote, _curvePool, _clearingHouse) {}

    // simplified setter
    function __TestPerpetual_setGlobalPosition(uint128 timeOfLastTrade, int256 cumFundingRate) external {
        globalPosition = LibPerpetual.GlobalPosition({
            timeOfLastTrade: timeOfLastTrade,
            cumFundingRate: cumFundingRate,
            timeOfLastTwapUpdate: globalPosition.timeOfLastTwapUpdate,
            blockStartPrice: globalPosition.blockStartPrice
        });
    }

    function __TestPerpetual_setTraderPosition(
        address trader,
        int256 openNotional,
        int256 positionSize,
        int256 cumFundingRate
    ) external {
        traderPosition[trader] = LibPerpetual.UserPosition({
            openNotional: openNotional,
            positionSize: positionSize,
            cumFundingRate: cumFundingRate,
            liquidityBalance: 0
        });
    }

    function __TestPerpetual_manipulate_market(
        uint256 tokenToSell,
        uint256 tokenToBuy,
        uint256 amountToSell
    ) external returns (uint256) {
        require(tokenToSell < 2, "Index of tokenToSell invalid");
        require(tokenToBuy < 2, "Index of tokenToBuy invalid");

        if (tokenToSell == VQUOTE_INDEX) {
            vQuote.mint(amountToSell);
        } else {
            vBase.mint(amountToSell);
        }

        return market.exchange(tokenToSell, tokenToBuy, amountToSell, 0);
    }

    function __TestPerpetual_updateFunding() external {
        _updateFundingRate();
    }

    function __TestPerpetual_updateTwap() external {
        _updateTwap();
    }

    function __TestPerpetual_setTWAP(int256 _marketTwap, int256 _oracleTwap) external {
        marketTwap = _marketTwap;
        oracleTwap = _oracleTwap;
    }

    function __TestPerpetual_setBlockStartPrice(uint256 blockStartPrice) external {
        globalPosition.blockStartPrice = int256(blockStartPrice);
    }
}
