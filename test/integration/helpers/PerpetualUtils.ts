import {BigNumber} from 'ethers';
import env from 'hardhat';

import {User} from './setup';

export async function setUpPoolLiquidity(
  lp: User,
  depositAmount: BigNumber
): Promise<void> {
  await lp.usdc.approve(lp.vault.address, depositAmount);
  await lp.perpetual.provideLiquidity(depositAmount, lp.usdc.address);
}

let nextBlockTimestamp = 1000000000;
export async function setNextBlockTimestamp(): Promise<number> {
  nextBlockTimestamp += 1000000000;

  await env.network.provider.request({
    method: 'evm_setNextBlockTimestamp',
    params: [nextBlockTimestamp],
  });

  return nextBlockTimestamp;
}
