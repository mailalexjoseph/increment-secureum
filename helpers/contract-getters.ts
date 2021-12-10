import {PerpConfig, VaultConfig, OracleConfig} from '../markets/ethereum';
import {
  eEthereumNetwork,
  tEthereumAddress,
  BigNumber,
  iVAMMConfig,
} from './types';

export function getChainlinkForexAggregator(
  pair: string,
  network: eEthereumNetwork = eEthereumNetwork.main
): tEthereumAddress {
  //console.log("Aggregator is", PerpConfig.ChainlinkOracles[network]);
  //console.log("Pair is", PerpConfig.ChainlinkOracles[network][pair]);
  return PerpConfig.ChainlinkOracles[network][pair];
}

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

export function getQuoteAssetReserve(): BigNumber {
  return PerpConfig.VAMMConfig.QuoteAssetReserve;
}

export function getBaseAssetReserve(): BigNumber {
  return PerpConfig.VAMMConfig.BaseAssetReserve;
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

export function getVAMMConfig(): iVAMMConfig {
  return PerpConfig.VAMMConfig;
}
