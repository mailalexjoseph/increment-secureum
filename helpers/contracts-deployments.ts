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

// TODO: put into /market folder
export function getCryptoSwapConstructorArgs(
  deployer: tEthereumAddress,
  lpToken: tEthereumAddress,
  coinA: tEthereumAddress,
  coinB: tEthereumAddress
): CryptoSwapConstructorArguments {
  const FEE_RECEIVER = '0xeCb456EA5365865EbAb8a2661B0c503410e9B347'; // from: https://github.com/curvefi/curve-crypto-contract/blob/f66b0c7b33232b431a813b9201e47a35c70db1ab/scripts/deploy_mainnet_eurs_pool.py#L18
  const cryptoSwapConstructorArgs: CryptoSwapConstructorArguments = [
    deployer /* owner*/,
    FEE_RECEIVER /* admin_fee_receiver*/,
    BigNumber.from(5000)
      .mul(2 ** 2)
      .mul(10000) /* A */,
    utils.parseEther('0.0001') /*  gamma*/,
    utils.parseEther('0.0005') /*  mid_fee*/,
    utils.parseEther('0.0045') /*  out_fee*/,
    utils.parseUnits('10', 10) /*  allowed_extra_profit*/,
    utils.parseEther('0.005') /*  fee_gamma*/,
    utils.parseEther('0.0000055') /*  adjustment_step*/,
    utils.parseUnits('5', 9) /*  admin_fee*/,
    BigNumber.from(600) /*  ma_half_time*/,
    utils.parseEther('1.2') /*  initial_price*/, // TODO: dont hardcode initial price
    lpToken,
    [coinA, coinB],
  ];
  return cryptoSwapConstructorArgs;
}
