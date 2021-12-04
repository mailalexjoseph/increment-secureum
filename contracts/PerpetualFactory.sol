// SPDX-License-Identifier: MIT

pragma solidity 0.8.4;

// interfaces
import {IPerpetualFactory} from "./interfaces/IPerpetualFactory.sol";
import {ICurveFactory} from "./interfaces/ICurveFactory.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";
import {IInsurance} from "./interfaces/IInsurance.sol";
import {IOracle} from "./interfaces/IOracle.sol";
import {ISafetyPool} from "./interfaces/ISafetyPool.sol";
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";

import {IncreOwnable} from "./utils/IncreOwnable.sol";

import {Perpetual} from "./Perpetual.sol";
import {Insurance} from "./Insurance.sol";
import {Oracle} from "./Oracle.sol";
import {SafetyPool} from "./SafetyPool.sol";
import {Vault} from "./Vault.sol";

contract PerpetualFactory is IPerpetualFactory, IncreOwnable {
    // collect all dependencies
    ICurveFactory public curveFactory;

    // deployed perpetuals & their vaults
    Perpetual[] public deployedPerpetuals;

    Vault[] public deployedVaults;
    mapping(IPerpetual => IVault[]) public vaultsUsed;

    Insurance public insurance;
    Oracle public oracle;
    SafetyPool public safetyPool;

    constructor(address _curveFactory) IncreOwnable() {
        require(_curveFactory != address(0), "Unknown address");
        curveFactory = ICurveFactory(_curveFactory);
    }

    function _deployCryptoSwap(
        string[32] memory _name,
        string[10] memory _symbol,
        address[8] memory _coins,
        uint256 _A,
        uint256 _fee,
        uint256 _asset_type,
        uint256 _implementation_idx
    ) external {
        // from curveFactory:
        // @notice Deploy a new plain pool
        // @param _name Name of the new plain pool
        // @param _symbol Symbol for the new plain pool - will be
        //                concatenated with factory symbol
        // @param _coins List of addresses of the coins being used in the pool.
        // @param _A Amplification co-efficient - a lower value here means
        //           less tolerance for imbalance within the pool's assets.
        //           Suggested values include:
        //            * Uncollateralized algorithmic stablecoins: 5-10
        //            * Non-redeemable, collateralized assets: 100
        //            * Redeemable assets: 200-400
        // @param _fee Trade fee, given as an integer with 1e10 precision. The
        //             minimum fee is 0.04% (4000000), the maximum is 1% (100000000).
        //             50% of the fee is distributed to veCRV holders.
        // @param _asset_type Asset type for pool, as an integer
        //                    0 = USD, 1 = ETH, 2 = BTC, 3 = Other
        // @param _implementation_idx Index of the implementation to use. All possible
        //             implementations for a pool of N_COINS can be publicly accessed
        //             via `plain_implementations(N_COINS)`
        // @return Address of the deployed pool

        // Verify all input even if it might be redundant)
        require(_coins.length > 1, "No coins specified");
        for (uint256 i = 0; i < _coins.length; i++) {
            require(_coins[i] != address(0), "No zero address");
        }
        require(_fee >= 4000000 && _fee <= 100000000, "Invalid fee");

        ICryptoSwap = curveFactory.deploy_plain_pool(
            _name,
            _symbol,
            _coins,
            _A,
            _fee,
            _asset_type,
            _implementation_idx
        );
    }

    function _deployPerpetual() external {
        Perpetual perpetual = new Perpetual(); // hardcode for now
        deployedPerpetuals.push(perpetual);
    }

    function _deployVault() external {
        Vault Vault = new Vault(10000, 13000); // hardcode for now
        deployedVaults.push(Vault);
    }

    function _deployOracle() external {}

    function _deploySafetyPool() external {}

    function _deployInsurance() external {}
}
