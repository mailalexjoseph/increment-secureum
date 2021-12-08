import {
  eEthereumNetwork,
  PerpetualConstructorArguments,
  VaultConstructorArguments,
  OracleConstructorArguments,
  tEthereumAddress,
} from '../helpers/types';
import {getReserveAddress} from '../helpers/contract-getters';
import {getFeedRegistryAddress} from '../helpers/contract-getters';
import {getEthereumNetworkFromHRE} from '../helpers/misc-utils';

import {HardhatRuntimeEnvironment} from 'hardhat/types';

export function getOracleConstructorArgs(
  hre: HardhatRuntimeEnvironment
): OracleConstructorArguments {
  return _getOracleConstructorArgsByNetwork(getEthereumNetworkFromHRE(hre));
}
function _getOracleConstructorArgsByNetwork(
  network: eEthereumNetwork
): OracleConstructorArguments {
  const oracleConstructorArguments: OracleConstructorArguments = [
    getFeedRegistryAddress(network),
  ];
  return oracleConstructorArguments;
}

export function getPerpetualConstructorArgs(
  oracleAddress: tEthereumAddress
): PerpetualConstructorArguments {
  return _getPerpetualArgsByNetwork(oracleAddress);
}

function _getPerpetualArgsByNetwork(
  oracleAddress: tEthereumAddress
): PerpetualConstructorArguments {
  const perpetualConstructorArgs: PerpetualConstructorArguments = [
    oracleAddress,
  ];
  return perpetualConstructorArgs;
}

export function getVaultConstructorArgs(
  hre: HardhatRuntimeEnvironment,
  perpetualAddress: tEthereumAddress,
  oracleAddress: tEthereumAddress
): VaultConstructorArguments {
  return _getVaultArgsByNetwork(
    getEthereumNetworkFromHRE(hre),
    perpetualAddress,
    oracleAddress
  );
}

function _getVaultArgsByNetwork(
  network: eEthereumNetwork,
  perpetualAddress: tEthereumAddress,
  oracleAddress: tEthereumAddress
): VaultConstructorArguments {
  const vaultConstructorArgs: VaultConstructorArguments = [
    perpetualAddress,
    oracleAddress,
    getReserveAddress('USDC', network),
  ];
  return vaultConstructorArgs;
}
