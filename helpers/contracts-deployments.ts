import {
  eEthereumNetwork,
  PerpetualConstructorArguments,
  SetReserveTokenArguments,
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

export function getConstructorArgs(
  hre: HardhatRuntimeEnvironment
): PerpetualConstructorArguments {
  return _getConstructorArgsByNetwork(getEthereumNetworkFromHRE(hre));
}

function _getConstructorArgsByNetwork(
  network: eEthereumNetwork
): PerpetualConstructorArguments {
  const constructorArgs: PerpetualConstructorArguments = [
    getQuoteAssetReserve(),
    getBaseAssetReserve(),
    getChainlinkForexAggregator('JPY_USD', network),
    getLendingPoolAddressProvider(network),
  ];
  //console.log('PerpetualConstructorArguments are', constructorArgs);
  return constructorArgs;
}

function _getInitArgsByNetwork(
  network: eEthereumNetwork
): SetReserveTokenArguments {
  const setReserveTokenArgs: SetReserveTokenArguments = [
    getReserveAddress('USDC', network),
    getReserveOracleAddress('USDC', network),
    false,
    getReserveAddress('USDC', network),
  ];
  //console.log('ConstructorArguments are', constructorArgs);
  return setReserveTokenArgs;
}

export function getInitArgs(
  hre: HardhatRuntimeEnvironment
): SetReserveTokenArguments {
  return _getInitArgsByNetwork(getEthereumNetworkFromHRE(hre));
}
