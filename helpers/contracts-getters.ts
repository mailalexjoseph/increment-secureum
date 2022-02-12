import {VaultConfig, ChainlinkOracleConfig} from '../markets/ethereum';
import {eEthereumNetwork, tEthereumAddress} from './types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {
  CurveTokenV5,
  CurveCryptoSwap2ETH,
  Factory,
  CurveTokenV5__factory,
  CurveCryptoSwap2ETH__factory,
  Factory__factory,
} from '../contracts-vyper/typechain';

import {getCurveFactoryAddress} from './contracts-deployments';
import {ethers} from 'hardhat';

export async function getCryptoSwapFactory(
  hre: HardhatRuntimeEnvironment
): Promise<Factory> {
  return <Factory>(
    await ethers.getContractAt(
      Factory__factory.abi,
      getCurveFactoryAddress(hre)
    )
  );
}

export async function getCryptoSwap(
  factory: Factory
): Promise<CurveCryptoSwap2ETH> {
  const vQuote = await ethers.getContract('VBase');
  const vBase = await ethers.getContract('VQuote');

  const cryptoSwapAddress = await factory[
    'find_pool_for_coins(address,address)'
  ](vQuote.address, vBase.address);

  return <CurveCryptoSwap2ETH>(
    await ethers.getContractAt(
      CurveCryptoSwap2ETH__factory.abi,
      cryptoSwapAddress
    )
  );
}

export async function getCurveToken(
  cryptoswap: CurveCryptoSwap2ETH
): Promise<CurveTokenV5> {
  const curveTokenAddress = await cryptoswap.token();

  return <CurveTokenV5>(
    await ethers.getContractAt(CurveTokenV5__factory.abi, curveTokenAddress)
  );
}

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
