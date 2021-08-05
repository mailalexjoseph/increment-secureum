import {PerpConfig} from '../markets/ethereum';
import {eEthereumNetwork, tEthereumAddress} from './types';

export function getForexOracleAddress(
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
