import {
  eEthereumNetwork,
  PerpetualConstructorArguments,
  VaultConstructorArguments,
  tEthereumAddress,
} from '../helpers/types';
import {
  getReserveAddress,
  getQuoteAssetReserve,
  getBaseAssetReserve,
} from '../helpers/contract-getters';
import {getEthereumNetworkFromHRE} from '../helpers/misc-utils';

import {HardhatRuntimeEnvironment} from 'hardhat/types';

export function getPerpetualConstructorArgs(): PerpetualConstructorArguments {
  return _getPerpetualArgsByNetwork();
}

function _getPerpetualArgsByNetwork(): PerpetualConstructorArguments {
  const perpetualConstructorArgs: PerpetualConstructorArguments = [
    getQuoteAssetReserve(),
    getBaseAssetReserve(),
  ];
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
  return vaultConstructorArgs;
}
