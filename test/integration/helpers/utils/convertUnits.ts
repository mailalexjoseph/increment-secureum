import {utils} from 'ethers';
import {BigNumber} from '../../../../helpers/types';
import {ERC20} from '../../../../typechain';
import {convertToCurrencyUnits} from '../../../../helpers/contracts-helpers';

export async function bigNumberToEther(
  number: BigNumber,
  token: ERC20
): Promise<BigNumber> {
  const numString: string = await convertToCurrencyUnits(token, number);
  return utils.parseEther(numString);
}
