import {
  eEthereumNetwork,
  VaultConstructorArguments,
  OracleConstructorArguments,
  tEthereumAddress,
} from '../helpers/types';
import {
  getReserveAddress,
  getFeedRegistryAddress,
} from '../helpers/contract-getters';
import {getEthereumNetworkFromHRE} from '../helpers/misc-utils';
import {integrations} from '../markets/ethereum';
import {OracleConfig} from '../markets/ethereum';

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

export function getVaultConstructorArgs(
  hre: HardhatRuntimeEnvironment,
  oracleAddress: tEthereumAddress
): VaultConstructorArguments {
  return _getVaultArgsByNetwork(getEthereumNetworkFromHRE(hre), oracleAddress);
}

function _getVaultArgsByNetwork(
  network: eEthereumNetwork,
  oracleAddress: tEthereumAddress
): VaultConstructorArguments {
  const vaultConstructorArgs: VaultConstructorArguments = [
    oracleAddress,
    getReserveAddress('USDC', network),
  ];
  return vaultConstructorArgs;
}

export function getCurveFactoryAddress(
  hre: HardhatRuntimeEnvironment
): tEthereumAddress {
  const ethereumNetwork = getEthereumNetworkFromHRE(hre);
  return integrations[ethereumNetwork].CURVE_FACTORY_CONTRACT;
}

export function getChainlinkOracle(
  hre: HardhatRuntimeEnvironment,
  name: string
): tEthereumAddress {
  const ethereumNetwork = getEthereumNetworkFromHRE(hre);
  return OracleConfig.ChainlinkOracles[ethereumNetwork][name];
}
