import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';

const WAY = ethers.utils.parseEther('1');

export const rMul = (a: BigNumber, b: BigNumber): BigNumber =>
  a.mul(b).div(WAY);

export const rDiv = (a: BigNumber, b: BigNumber): BigNumber =>
  a.mul(WAY).div(b);

export const asBigNumber = (number: string): BigNumber =>
  ethers.utils.parseEther(number);

export const asDecimal = (number: BigNumber): string =>
  ethers.utils.formatEther(number);
