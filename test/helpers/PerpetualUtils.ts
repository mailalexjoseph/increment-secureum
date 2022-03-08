import {BigNumber} from 'ethers';
import {CurveCryptoSwap2ETH} from '../../contracts-vyper/typechain';
import {IERC20Metadata} from '../../typechain';
import {User} from './setup';
import {ethers} from 'hardhat';
import {wadToToken} from '../../helpers/contracts-helpers';
import {TEST_get_exactOutputSwap} from './CurveUtils';
import {Side} from './utils/types';
import {UserPositionStructOutput} from '../../typechain/ClearingHouse';

export async function setUpPoolLiquidity(
  lp: User,
  depositAmount: BigNumber
): Promise<void> {
  await lp.usdc.approve(lp.vault.address, depositAmount);
  await lp.clearingHouse.provideLiquidity(0, depositAmount, lp.usdc.address);
}

/* helper functions */
async function _checkTokenBalance(
  user: User,
  token: IERC20Metadata,
  usdcAmount: BigNumber
): Promise<void> {
  const usdcBalance = await token.balanceOf(user.address);
  if (usdcAmount.gt(usdcBalance)) {
    throw `${user.address} balance of ${usdcBalance} not enough to deposit ${usdcAmount}`;
  }
}

export async function derive_tentativeQuoteAmount(
  position: UserPositionStructOutput,
  market: CurveCryptoSwap2ETH
): Promise<BigNumber> {
  let tentativeQuoteAmount;
  if (position.positionSize.gte(0)) {
    tentativeQuoteAmount = BigNumber.from(0);
  } else {
    tentativeQuoteAmount = (
      await TEST_get_exactOutputSwap(
        market,
        position.positionSize.abs(),
        ethers.constants.MaxUint256,
        0,
        1
      )
    ).amountIn;
  }
  return tentativeQuoteAmount;
}

// open position with 18 decimals
export async function extendPositionWithCollateral(
  user: User,
  token: IERC20Metadata,
  depositAmount: BigNumber,
  positionAmount: BigNumber,
  direction: Side
): Promise<void> {
  // get liquidity amount in USD
  const tokenAmount = await wadToToken(await token.decimals(), depositAmount);
  await _checkTokenBalance(user, token, tokenAmount);

  await token.approve(user.vault.address, depositAmount);
  await user.clearingHouse.deposit(0, tokenAmount, token.address);

  await user.clearingHouse.extendPosition(0, positionAmount, direction, 0);
}

// reduce or close a position
export async function reducePosition(
  user: User,
  direction: Side,
  token: IERC20Metadata
): Promise<void> {
  const traderPosition = await user.perpetual.getTraderPosition(user.address);

  let proposedAmount;
  if (direction === Side.Long) {
    proposedAmount = traderPosition.positionSize;
  } else {
    proposedAmount = await derive_tentativeQuoteAmount(
      traderPosition,
      user.market
    );
  }

  await user.clearingHouse.reducePosition(0, proposedAmount, 0);

  const userDeposits = await user.vault.getReserveValue(0, user.address);
  await user.clearingHouse.withdraw(0, userDeposits, token.address);
}

// provide liquidity with 18 decimals
export async function provideLiquidity(
  user: User,
  token: IERC20Metadata,
  liquidityAmount: BigNumber
): Promise<void> {
  // get liquidity amount in USD
  const tokenAmount = await wadToToken(await token.decimals(), liquidityAmount);
  await _checkTokenBalance(user, token, tokenAmount);

  await token.approve(user.vault.address, tokenAmount);
  await user.clearingHouse.provideLiquidity(0, tokenAmount, token.address);
}

// withdraw liquidity
export async function withdrawLiquidity(
  user: User,
  token: IERC20Metadata
): Promise<void> {
  const userLpPosition = await user.perpetual.getLpPosition(user.address);
  const providedLiquidity = userLpPosition.liquidityBalance;

  await user.clearingHouse.removeLiquidity(0, providedLiquidity);

  const positionAfter = await user.perpetual.getLpPosition(user.address);

  if (positionAfter.liquidityBalance.gt(0)) {
    throw 'Liquidity not withdrawn';
  }

  const tentativeQuoteAmount = await derive_tentativeQuoteAmount(
    positionAfter,
    user.market
  );
  await user.clearingHouse.settleAndWithdrawLiquidity(
    0,
    tentativeQuoteAmount,
    0,
    token.address
  );
}

// calculate
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
  Swap for exact with curve.
  1) swap amountInMaximum for amountOutTmp
  2) swap all remaining tokens (amountOutTmp - amountOut) for amountIn
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
