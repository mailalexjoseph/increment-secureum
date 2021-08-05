import {eEthereumNetwork, tEthereumAddress} from '../helpers/types';
import {PerpConfig} from '../markets/ethereum';
import {BigNumber} from 'ethers';

type ConstructorArguments = [
  BigNumber,
  BigNumber,
  tEthereumAddress,
  tEthereumAddress
];
export function getConstructorArgsByNetwork(
  network: eEthereumNetwork
): ConstructorArguments {
  const quoteAssetReserve = PerpConfig.VAMMConfig.QuoteAssetReserve;
  const baseAssetReserve = PerpConfig.VAMMConfig.BaseAssetReserve;
  const quoteAssetOracle = PerpConfig.ChainlinkForexAggregator[network].JPY_USD;
  const lendingPoolAddressProvider =
    PerpConfig.Integrations[network].lendingPoolAddressProvider;

  const constructorArgs: ConstructorArguments = [
    quoteAssetReserve,
    baseAssetReserve,
    quoteAssetOracle,
    lendingPoolAddressProvider,
  ];
  //console.log('ConstructorArguments are', constructorArgs);
  return constructorArgs;
}
