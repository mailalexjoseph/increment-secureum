// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// contracts
import {Perpetual} from "../Perpetual.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Context} from "@openzeppelin/contracts/utils/Context.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/security/Pausable.sol";
import {IncreOwnable} from "../utils/IncreOwnable.sol";
import {VirtualToken} from "../tokens/VirtualToken.sol";
import {PoolTWAPOracle} from "../oracles/PoolTWAPOracle.sol";
import {ChainlinkTWAPOracle} from "../oracles/ChainlinkTWAPOracle.sol";

// interfaces
import {IPerpetual} from "../interfaces/IPerpetual.sol";
import {IVault} from "../interfaces/IVault.sol";
import {ICryptoSwap} from "../interfaces/ICryptoSwap.sol";
import {IChainlinkOracle} from "../interfaces/IChainlinkOracle.sol";
import {IVirtualToken} from "../interfaces/IVirtualToken.sol";

// libraries
import {LibMath} from "../lib/LibMath.sol";
import {LibPerpetual} from "../lib/LibPerpetual.sol";

import "hardhat/console.sol";

/*
 * TestPerpetual includes some setter functions to edit part of
 * the internal state of Perpetual which aren't exposed otherwise.
 */
contract TestPerpetual is Perpetual {
    constructor(
        IChainlinkOracle _chainlinkOracle,
        PoolTWAPOracle _poolTWAPOracle,
        ChainlinkTWAPOracle _chainlinkTWAPOracle,
        IVirtualToken _vBase,
        IVirtualToken _vQuote,
        ICryptoSwap _curvePool,
        IVault _vault
    ) Perpetual(_chainlinkOracle, _poolTWAPOracle, _chainlinkTWAPOracle, _vBase, _vQuote, _curvePool, _vault) {}

    // simplified setter
    function setGlobalPosition(
        int256 cumTradePremium,
        uint128 timeOfLastTrade,
        int256 premium,
        int256 cumFundingRate
    ) external {
        globalPosition = LibPerpetual.GlobalPosition({
            cumTradePremium: cumTradePremium,
            timeOfLastTrade: timeOfLastTrade,
            premium: premium,
            cumFundingRate: cumFundingRate
        });
    }
}
