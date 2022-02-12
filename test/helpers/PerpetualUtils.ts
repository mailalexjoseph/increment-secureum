import {BigNumber} from 'ethers';
import {CurveCryptoSwap2ETH} from '../../contracts-vyper/typechain';
import {User} from './setup';

export async function setUpPoolLiquidity(
  lp: User,
  depositAmount: BigNumber
): Promise<void> {
  await lp.usdc.approve(lp.vault.address, depositAmount);
  await lp.perpetual.provideLiquidity(depositAmount, lp.usdc.address);
}

export async function calcCloseShortPosition(
  market: CurveCryptoSwap2ETH,
  amountInMaximum: BigNumber,
  amountOut: BigNumber
): Promise<BigNumber> {
  const QUOTE_INDEX = 0;
  const BASE_INDEX = 1;

  return calcSwapForExact(
    market,
    amountInMaximum,
    amountOut,
    QUOTE_INDEX,
    BASE_INDEX
  );
}

/*
  Swap for exact with curve
  https://docs.uniswap.org/protocol/guides/swaps/single-swaps#exact-output-swaps
*/
export async function calcSwapForExact(
  market: CurveCryptoSwap2ETH,
  amountInMaximum: BigNumber,
  amountOut: BigNumber,
  inIndex: number,
  outIndex: number
): Promise<BigNumber> {
  // initial swap
  const amountOutRealized = await market.get_dy(
    inIndex,
    outIndex,
    amountInMaximum
  );

  const amountOutRemaining = amountOut.sub(amountOutRealized);
  if (amountOutRemaining.lt(0)) {
    throw new Error(
      `Amount out realized is less than amount out: ${amountOutRealized} < ${amountOut}`
    );
  }
  // swap leftover
  const amountIn = await market.get_dy(outIndex, inIndex, amountOutRemaining);
  return amountIn;
}
