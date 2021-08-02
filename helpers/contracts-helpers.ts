/*

import {Contract, Signer, ethers} from 'ethers';

import {tEthereumAddress} from './types';
//import {getIErc20Detailed} from './contracts-getters';

export const convertToCurrencyDecimals = async (
  tokenAddress: tEthereumAddress,
  amount: string
) => {
  const token = await getIErc20Detailed(tokenAddress);
  let decimals = (await token.decimals()).toString();
  return ethers.utils.parseUnits(amount, decimals);
};

export const convertToCurrencyUnits = async (
  tokenAddress: string,
  amount: string
) => {
  const token = await getIErc20Detailed(tokenAddress);
  let decimals = await token.decimals();
  return ethers.utils.formatUnits(amount, decimals);
};
*/
