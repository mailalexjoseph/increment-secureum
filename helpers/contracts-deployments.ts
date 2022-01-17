import {
  eEthereumNetwork,
  VaultConstructorArguments,
  OracleConstructorArguments,
  CryptoSwapConstructorArguments,
  tEthereumAddress,
} from '../helpers/types';
import {
  getReserveAddress,
  getFeedRegistryAddress,
} from '../helpers/contract-getters';
import {getEthereumNetworkFromHRE} from '../helpers/misc-utils';
import {integrations} from '../markets/ethereum';
import {OracleConfig} from '../markets/ethereum';
import {utils, BigNumber} from 'ethers';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

export function getOracleConstructorArgs(
  hre: HardhatRuntimeEnvironment
): OracleConstructorArguments {
  return _getOracleConstructorArgsByNetwork(getEthereumNetworkFromHRE(hre));
}
function _getOracleConstructorArgsByNetwork(
  network: eEthereumNetwork
): OracleConstructorArguments {
  const oracleConstructorArguments: OracleConstructorArguments = [
    getFeedRegistryAddress(network),
  ];
  return oracleConstructorArguments;
}

export function getVaultConstructorArgs(
  hre: HardhatRuntimeEnvironment,
  oracleAddress: tEthereumAddress
): VaultConstructorArguments {
  return _getVaultArgsByNetwork(getEthereumNetworkFromHRE(hre), oracleAddress);
}

function _getVaultArgsByNetwork(
  network: eEthereumNetwork,
  oracleAddress: tEthereumAddress
): VaultConstructorArguments {
  const vaultConstructorArgs: VaultConstructorArguments = [
    oracleAddress,
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
  return OracleConfig.ChainlinkOracles[ethereumNetwork][name];
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
    owner: deployer /* owner*/,
    admin_fee_receiver: FEE_RECEIVER /* admin_fee_receiver*/,
    A: BigNumber.from(5000)
      .mul(2 ** 2)
      .mul(10000) /* A */,
    gamma: utils.parseEther('0.0001') /*  gamma*/,
    mid_fee: utils.parseUnits('0.0005', 10) /*  mid_fee*/,
    out_fee: utils.parseUnits('0.0045', 10) /*  out_fee*/,
    allowed_extra_profit: utils.parseUnits('10', 10) /*  allowed_extra_profit*/,
    fee_gamma: utils.parseEther('0.005') /*  fee_gamma*/,
    adjustment_step: utils.parseEther('0.0000055') /*  adjustment_step*/,
    admin_fee: utils.parseUnits('5', 9) /*  admin_fee*/,
    ma_half_time: BigNumber.from(600) /*  ma_half_time*/,
    initial_price: initialPrice /*  initial_price*/, // TODO: dont hardcode initial price
    lp_token: lpToken,
    reserve_tokens: [quoteToken, baseToken],
  };
  return cryptoSwapConstructorArgs;
}
