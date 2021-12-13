import {VaultConfig, OracleConfig} from '../markets/ethereum';
import {eEthereumNetwork, tEthereumAddress} from './types';

export function getReserveAddress(
  reserveAssetName: string,
  network: eEthereumNetwork = eEthereumNetwork.main
): tEthereumAddress {
  return VaultConfig.ReserveAssets[network][reserveAssetName];
}

export function getReserveOracleAddress(
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
  return OracleConfig.ChainlinkOracles[network].FEED_REGISTRY;
}
