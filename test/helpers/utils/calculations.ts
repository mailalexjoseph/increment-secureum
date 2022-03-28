import {BigNumber, utils} from 'ethers';

const WAY = utils.parseEther('1');

export const rMul = (a: BigNumber, b: BigNumber): BigNumber =>
  a.mul(b).div(WAY);

export const rDiv = (a: BigNumber, b: BigNumber): BigNumber =>
  a.mul(WAY).div(b);

export const asBigNumber = (number: string): BigNumber =>
  utils.parseEther(number);

export const asDecimal = (number: BigNumber): string =>
  utils.formatEther(number);
