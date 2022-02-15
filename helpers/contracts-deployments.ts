import {
  CurveCryptoSwapTestConstructorArguments,
  CurveCryptoSwap2ETHConstructorArguments,
  tEthereumAddress,
  eEthereumNetwork,
} from '../helpers/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {cryptoSwapConfig} from '../markets/ethereum';

import {utils, BigNumber} from 'ethers';
import {ZERO_ADDRESS} from './constants';
import {getEthereumNetworkFromHRE} from '../helpers/misc-utils';

export function getPerpetualVersionToUse(
  hre: HardhatRuntimeEnvironment
): string {
  if (getEthereumNetworkFromHRE(hre) === eEthereumNetwork.hardhat) {
    return 'TestPerpetual';
  }
  return 'Perpetual';
}

// constructor variables for factory deployments of Curve Crypto Contracts
// https://github.com/curvefi/curve-factory-crypto/blob/e2a59ab163b5b715b38500585a5d1d9c0671eb34/contracts/Factory.vy#L151-L164
export function getCryptoSwapConstructorArgs(
  pair: string,
  quoteToken: tEthereumAddress,
  baseToken: tEthereumAddress,
  initialPrice: BigNumber
): CurveCryptoSwap2ETHConstructorArguments {
  if (
    initialPrice.isZero() ||
    quoteToken == ZERO_ADDRESS ||
    baseToken == ZERO_ADDRESS
  ) {
    throw `Invalid arguments: initialPrice: ${initialPrice}, quoteToken: ${quoteToken}, baseToken: ${baseToken}`;
  }

  // overwrite undefined
  const cryptoSwapConstructorArgs = cryptoSwapConfig.markets[pair];
  cryptoSwapConstructorArgs.initial_price = initialPrice;
  cryptoSwapConstructorArgs._coins = [quoteToken, baseToken];

  return cryptoSwapConstructorArgs;
}

/*
DEPRECATED method now using the curve factory contract

constructor variables for separate deployment of Curve Crypto Contracts
deprecated (see: https://github.com/curvefi/curve-crypto-contract)
*/
export function getCryptoSwapConstructorArgsSeparate(
  deployer: tEthereumAddress,
  initialPrice: BigNumber,
  lpToken: tEthereumAddress,
  quoteToken: tEthereumAddress,
  baseToken: tEthereumAddress
): CurveCryptoSwapTestConstructorArguments {
  const FEE_RECEIVER = '0xeCb456EA5365865EbAb8a2661B0c503410e9B347'; // from: https://github.com/curvefi/curve-crypto-contract/blob/f66b0c7b33232b431a813b9201e47a35c70db1ab/scripts/deploy_mainnet_eurs_pool.py#L18
  const cryptoSwapConstructorArgs: CurveCryptoSwapTestConstructorArguments = {
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
