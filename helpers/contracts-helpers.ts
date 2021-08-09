import {utils} from 'ethers';
import {ERC20} from '../typechain';
import {BigNumber} from './types';

export async function convertToCurrencyDecimals(
  token: ERC20,
  amount: string
): Promise<BigNumber> {
  const decimals = (await token.decimals()).toString();
  return utils.parseUnits(amount, decimals);
}

export async function convertToCurrencyUnits(
  token: ERC20,
  amount: BigNumber
): Promise<string> {
  const decimals = await token.decimals();
  return utils.formatUnits(amount, decimals);
}
