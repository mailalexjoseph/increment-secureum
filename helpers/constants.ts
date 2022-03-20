import {utils} from 'ethers';
import {ethers} from 'hardhat';
// ----------------
// MATH
// ----------------

export const MAX_UINT_AMOUNT = ethers.BigNumber.from(
  '115792089237316195423570985008687907853269984665640564039457584007913129639935'
);
export const ONE_YEAR = '31536000';
export const ZERO_ADDRESS = utils.getAddress(
  '0x0000000000000000000000000000000000000000'
);
export const DEAD_ADDRESS = utils.getAddress(
  '0x000000000000000000000000000000000000dEaD'
);
export const ONE_ADDRESS = '0x0000000000000000000000000000000000000001';

export const WAD = utils.parseUnits('1.0', 18);
export const RAY = utils.parseUnits('1.0', 27);

export const FULL_REDUCTION_RATIO = ethers.utils.parseEther('1');
