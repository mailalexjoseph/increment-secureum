import {BigNumber} from 'ethers';

import {User} from './setup';

export async function setUpPoolLiquidity(
  lp: User,
  depositAmount: BigNumber
): Promise<void> {
  await lp.usdc.approve(lp.vault.address, depositAmount);
  await lp.perpetual.provideLiquidity(depositAmount, lp.usdc.address);
}
