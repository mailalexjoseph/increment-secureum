import {
  eEthereumNetwork,
  VaultConstructorArguments,
  ChainlinkOracleConstructorArguments,
  CryptoSwapConstructorArguments,
  tEthereumAddress,
} from '../helpers/types';
import {
  getReserveAddress,
  getFeedRegistryAddress,
} from '../helpers/contract-getters';
import {getEthereumNetworkFromHRE} from '../helpers/misc-utils';
import {integrations} from '../markets/ethereum';
import {ChainlinkOracleConfig} from '../markets/ethereum';
import {utils, BigNumber} from 'ethers';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

export function getChainlinkOracleConstructorArgs(
  hre: HardhatRuntimeEnvironment
): ChainlinkOracleConstructorArguments {
  return _getChainlinkOracleConstructorArgsByNetwork(
    getEthereumNetworkFromHRE(hre)
  );
}
function _getChainlinkOracleConstructorArgsByNetwork(
  network: eEthereumNetwork
): ChainlinkOracleConstructorArguments {
  const chainlinkOracleConstructorArguments: ChainlinkOracleConstructorArguments =
    [getFeedRegistryAddress(network)];
  return chainlinkOracleConstructorArguments;
}

export function getVaultConstructorArgs(
  hre: HardhatRuntimeEnvironment,
  chainlinkOracleAddress: tEthereumAddress
): VaultConstructorArguments {
  return _getVaultArgsByNetwork(
    getEthereumNetworkFromHRE(hre),
    chainlinkOracleAddress
  );
}

function _getVaultArgsByNetwork(
  network: eEthereumNetwork,
  chainlinkOracleAddress: tEthereumAddress
): VaultConstructorArguments {
  const vaultConstructorArgs: VaultConstructorArguments = [
    chainlinkOracleAddress,
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
  return ChainlinkOracleConfig.ChainlinkOracles[ethereumNetwork][name];
}

export function getPerpetualVersionToUse(
  hre: HardhatRuntimeEnvironment
): string {
  if (getEthereumNetworkFromHRE(hre) === eEthereumNetwork.hardhat) {
    return 'TestPerpetual';
  }
  return 'Perpetual';
}

export async function getChainlinkPrice(
  hre: HardhatRuntimeEnvironment,
  pair: string
): Promise<BigNumber> {
  /* We have to use the chainlink price here since we use the oracle price to distribute the initial liquidity
  in the perpetual contracts. In case the price changes during deployment, the deployment could (potentially) fail.
  */
  const oracle = await hre.ethers.getContractAt(
    'AggregatorV3Interface',
    getChainlinkOracle(hre, pair)
  );
  if (!oracle) {
    throw new Error(
      `Could not get chainlink oracle for ${pair}, on network ${hre.network}`
    );
  }
  const answer = await oracle.latestRoundData();
  const decimals = await oracle.decimals();
  const priceAsString = hre.ethers.utils.formatUnits(answer.answer, decimals);
  return hre.ethers.utils.parseEther(priceAsString);
}

// TODO: put into /market folder
export function getCryptoSwapConstructorArgs(
  deployer: tEthereumAddress,
  initialPrice: BigNumber,
  lpToken: tEthereumAddress,
  quoteToken: tEthereumAddress,
  baseToken: tEthereumAddress
): CryptoSwapConstructorArguments {
  const FEE_RECEIVER = '0xeCb456EA5365865EbAb8a2661B0c503410e9B347'; // from: https://github.com/curvefi/curve-crypto-contract/blob/f66b0c7b33232b431a813b9201e47a35c70db1ab/scripts/deploy_mainnet_eurs_pool.py#L18
  const cryptoSwapConstructorArgs: CryptoSwapConstructorArguments = {
    owner: deployer,
    admin_fee_receiver: FEE_RECEIVER,
    A: BigNumber.from(5000)
      .mul(2 ** 2)
      .mul(10000),
    gamma: utils.parseEther('0.0001'),
    mid_fee: utils.parseUnits('0.0005', 10),
    out_fee: utils.parseUnits('0.0045', 10),
    allowed_extra_profit: utils.parseUnits('10', 10),
    fee_gamma: utils.parseEther('0.005'),
    adjustment_step: utils.parseEther('0.0000055'),
    admin_fee: utils.parseUnits('5', 9),
    ma_half_time: BigNumber.from(600),
    initial_price: initialPrice,
    curve_token: lpToken,
    reserve_tokens: [quoteToken, baseToken],
  };
  return cryptoSwapConstructorArgs;
}
