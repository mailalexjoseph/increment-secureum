import {PerpConfig} from '../markets/ethereum';
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
  //console.log("Aggregator is", PerpConfig.ChainlinkForexAggregator[network]);
  //console.log("Pair is", PerpConfig.ChainlinkForexAggregator[network][pair]);
  return PerpConfig.ChainlinkForexAggregator[network][pair];
}

export function getReserveAddress(
  reserveAssetName: string,
  network: eEthereumNetwork = eEthereumNetwork.main
): tEthereumAddress {
  return PerpConfig.ReserveAssets[network][reserveAssetName];
}

export function getReserveOracleAddress(
  reserveAssetName: string,
  network: eEthereumNetwork = eEthereumNetwork.main
): tEthereumAddress {
  return PerpConfig.ChainlinkReserveAggregator[network][reserveAssetName];
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
  return PerpConfig.Integrations[network].lendingPoolAddressProvider;
}

export function getVAMMConfig(): iVAMMConfig {
  return PerpConfig.VAMMConfig;
}
