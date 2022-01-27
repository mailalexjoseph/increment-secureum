import {VaultConfig, ChainlinkOracleConfig} from '../markets/ethereum';
import {eEthereumNetwork, tEthereumAddress} from './types';

export function getReserveAddress(
  reserveAssetName: string,
  network: eEthereumNetwork = eEthereumNetwork.main
): tEthereumAddress {
  return VaultConfig.ReserveAssets[network][reserveAssetName];
}

export function getReserveChainlinkOracleAddress(
  reserveAssetName: string,
  network: eEthereumNetwork = eEthereumNetwork.main
): tEthereumAddress {
  return VaultConfig.ChainlinkOracles[network][reserveAssetName];
}

export function getLendingPoolAddressProvider(
  network: eEthereumNetwork = eEthereumNetwork.main
): tEthereumAddress {
  return VaultConfig.Integrations[network].lendingPoolAddressProvider;
}

export function getFeedRegistryAddress(
  network: eEthereumNetwork = eEthereumNetwork.main
): tEthereumAddress {
  return ChainlinkOracleConfig.ChainlinkOracles[network].FEED_REGISTRY;
}
