import {
  eEthereumNetwork,
  PerpetualConstructorArguments,
  VaultConstructorArguments,
  tEthereumAddress,
} from '../helpers/types';
import {
  getReserveAddress,
  getReserveOracleAddress,
  getChainlinkForexAggregator,
  getQuoteAssetReserve,
  getBaseAssetReserve,
  getLendingPoolAddressProvider,
} from '../helpers/contract-getters';
import {getEthereumNetworkFromHRE} from '../helpers/misc-utils';

import {HardhatRuntimeEnvironment} from 'hardhat/types';

export function getPerpetualConstructorArgs(
  hre: HardhatRuntimeEnvironment
): PerpetualConstructorArguments {
  return _getPerpetualArgsByNetwork(getEthereumNetworkFromHRE(hre));
}

function _getPerpetualArgsByNetwork(
  network: eEthereumNetwork
): PerpetualConstructorArguments {
  const perpetualConstructorArgs: PerpetualConstructorArguments = [
    getQuoteAssetReserve(),
    getBaseAssetReserve(),
    // getChainlinkForexAggregator('JPY_USD', network),
    // getLendingPoolAddressProvider(network),
  ];
  //console.log('PerpetualConstructorArguments are', constructorArgs);
  return perpetualConstructorArgs;
}

export function getVaultConstructorArgs(
  hre: HardhatRuntimeEnvironment,
  perpetualAddress: tEthereumAddress
): VaultConstructorArguments {
  return _getVaultArgsByNetwork(
    getEthereumNetworkFromHRE(hre),
    perpetualAddress
  );
}

function _getVaultArgsByNetwork(
  network: eEthereumNetwork,
  perpetualAddress: tEthereumAddress
): VaultConstructorArguments {
  const vaultConstructorArgs: VaultConstructorArguments = [
    perpetualAddress,
    getReserveAddress('USDC', network),
  ];
  //console.log('ConstructorArguments are', constructorArgs);
  return vaultConstructorArgs;
}
