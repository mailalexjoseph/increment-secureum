// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.4;

// interfaces
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPerpetualFactory} from "./interfaces/IPerpetualFactory.sol";
import {ICurveFactory} from "./interfaces/ICurveFactory.sol";
import {IPerpetual} from "./interfaces/IPerpetual.sol";
import {IVault} from "./interfaces/IVault.sol";
import {IInsurance} from "./interfaces/IInsurance.sol";
import {IOracle} from "./interfaces/IOracle.sol";
import {ISafetyPool} from "./interfaces/ISafetyPool.sol";
import {ICryptoSwap} from "./interfaces/ICryptoSwap.sol";
import {IVirtualToken} from "./interfaces/IVirtualToken.sol";

// contracts
import {IncreOwnable} from "./utils/IncreOwnable.sol";

import {Perpetual} from "./Perpetual.sol";
import {Insurance} from "./Insurance.sol";
import {Oracle} from "./Oracle.sol";
import {SafetyPool} from "./SafetyPool.sol";
import {Vault} from "./Vault.sol";
import {VirtualToken} from "./tokens/VirtualToken.sol";

contract PerpetualFactory is IPerpetualFactory, IncreOwnable {
    // collect all dependencies
    ICurveFactory public curveFactory;

    // deployed perpetuals & their vaults
    struct PerpetualInfo {
        IPerpetual perpetual;
        ICryptoSwap market;
        IVault vault;
    }
    PerpetualInfo[] deployedPerpetuals;

    mapping(IVault => IPerpetual) vaultUsed; // to allow multiple vaults per perpetual
    IInsurance public insurance;
    IOracle public oracle;

    constructor(ICurveFactory _curveFactory, address _chainlinkFeedRegistryInterface) IncreOwnable() {
        require(address(_curveFactory) != address(0), "Unknown address");
        curveFactory = _curveFactory;
        insurance = _deployInsurance();
        oracle = _deployOracle(_chainlinkFeedRegistryInterface);
    }

    // deployment functions
    function deployNewPerpetualMarket(
        string[32] memory _name,
        string[10] memory _symbol,
        IERC20 _reserveToken
    ) external {
        require(address(insurance) != address(0), "Insurance not deployed");
        require(address(oracle) != address(0), "Oracle not deployed");

        // deploy perpetual market
        IPerpetual perpetual = _deployPerpetual(oracle);

        // deploy trade tokens
        IVirtualToken tokenA = _deployVirtualTokens("Long EUR/USD", "Long EUR/USD", perpetual);
        IVirtualToken tokenB = _deployVirtualTokens("Short EUR/USD", "Short EUR/USD", perpetual);

        // deploy curve market
        // _A = 30, _fee =  4000000, _asset_type = 3, _implementation_idx = 0 /// TODO: find implementation idx (not sure what to select here)
        ICryptoSwap market = _deployCryptoSwap(_name, _symbol, [address(tokenA), address(tokenB)], 30, 4000000, 3, 0);
        perpetual.setMarket(market);

        // deploy vault
        IVault vault = _deployVault(perpetual, oracle, _reserveToken);
        vaultUsed[vault] = perpetual;

        deployedPerpetuals.push(PerpetualInfo(perpetual, market, vault));
    }

    function _deployVirtualTokens(
        string memory _name,
        string memory _symbol,
        IPerpetual _perpetual
    ) internal returns (IVirtualToken) {
        IVirtualToken virtualToken = new VirtualToken(_name, _symbol, _perpetual);
        return virtualToken;
    }

    function _deployCryptoSwap(
        string[32] memory _name,
        string[10] memory _symbol,
        address[2] memory _coins,
        uint256 _A,
        uint256 _fee,
        uint256 _asset_type,
        uint256 _implementation_idx
    ) internal returns (ICryptoSwap) {
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

        ICryptoSwap market = ICryptoSwap(
            curveFactory.deploy_plain_pool(_name, _symbol, _coins, _A, _fee, _asset_type, _implementation_idx)
        );
        return market;
    }

    function _deployPerpetual(IOracle _oracle) internal returns (IPerpetual) {
        Perpetual perpetual = new Perpetual(_oracle); // hardcode for now
        return perpetual;
    }

    function _deployVault(
        IPerpetual _perpetual,
        IOracle _oracle,
        IERC20 _reserveToken
    ) internal returns (IVault) {
        IVault vault = new Vault(_perpetual, _oracle, _reserveToken); // hardcode for now
        return vault;
    }

    function _deployOracle(address _chainlinkFeedRegistryInterface) internal returns (IOracle) {
        oracle = new Oracle(_chainlinkFeedRegistryInterface);
        return oracle;
    }

    function _deployInsurance() internal returns (IInsurance) {
        insurance = new Insurance();
        return insurance;
    }
}
