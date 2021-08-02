import {eEthereumNetwork, tEthereumAddress} from '../helpers/types';
import {PerpConfig} from '../markets/ethereum';
import {BigNumber} from 'ethers';

type args = [BigNumber, BigNumber, tEthereumAddress, tEthereumAddress];
export function getNetworkParameters(network: eEthereumNetwork): args {
  const quoteAssetReserve = PerpConfig.VAMMConfig.QuoteAssetReserve;
  const baseAssetReserve = PerpConfig.VAMMConfig.BaseAssetReserve;
  const quoteAssetOracle = PerpConfig.ChainlinkForexAggregator[network].JPY_USD;

  const lendingPoolAddressProvider =
    PerpConfig.Integrations[network].lendingPoolAddressProvider;
  const constructorArgs: args = [
    quoteAssetReserve,
    baseAssetReserve,
    quoteAssetOracle,
    lendingPoolAddressProvider,
  ];
  return constructorArgs as args;
}
