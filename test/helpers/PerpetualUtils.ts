import {User} from './setup';
import {ethers} from 'hardhat';

import {UserPositionStructOutput} from '../../typechain/Perpetual';
import {CurveCryptoSwap2ETH} from '../../contracts-vyper/typechain';
import {ERC20, IERC20Metadata} from '../../typechain';

import {wadToToken} from '../../helpers/contracts-helpers';
import {TEST_get_exactOutputSwap} from './CurveUtils';
import {rMul} from './utils/calculations';

import {BigNumber} from 'ethers';
import {Side} from './utils/types';
import {FULL_REDUCTION_RATIO} from '../../helpers/constants';

/* ********************************* */
/*   liquidity provider operations   */
/* ********************************* */

export async function setUpPoolLiquidity(
  lp: User,
  depositAmount: BigNumber
): Promise<void> {
  await lp.usdc.approve(lp.vault.address, depositAmount);
  await lp.clearingHouse.provideLiquidity(0, depositAmount, lp.usdc.address);
}

// Returns a proposed amount precise enough to close LP position
// whether it looks like a LONG or a SHORT
export async function liquidityProviderProposedAmount(
  position: UserPositionStructOutput,
  market: CurveCryptoSwap2ETH
): Promise<BigNumber> {
  return removeLiquidityProposedAmount(position, FULL_REDUCTION_RATIO, market);
}

// Returns a proposed amount precise enough to reduce a LP position
// whether it looks like a LONG or a SHORT
export async function removeLiquidityProposedAmount(
  position: UserPositionStructOutput,
  reductionRatio: BigNumber,
  market: CurveCryptoSwap2ETH
): Promise<BigNumber> {
  if (reductionRatio.gt(FULL_REDUCTION_RATIO) || reductionRatio.lt(0)) {
    throw new Error('reductionRatio must be between 0 and 1');
  }

  // total supply of lp tokens
  const lpTotalSupply = await (<ERC20>(
    await ethers.getContractAt('ERC20', await market.token())
  )).totalSupply();

  // withdrawable amount: balance * share of lp tokens (lpTokensOwned / lpTotalSupply) - 1 (favors existing LPs)
  /*
  for reference:
  https://github.com/Increment-Finance/increment-protocol/blob/c405099de6fddd6b0eeae56be674c00ee4015fc5/contracts-vyper/contracts/CurveCryptoSwap2ETH.vy#L1013
  */

  const lpTokenToWithdraw = rMul(position.liquidityBalance, reductionRatio);
  const positionSizeToReduce = rMul(position.positionSize, reductionRatio);

  const withdrawnBaseTokens = (await market.balances(1))
    .mul(lpTokenToWithdraw)
    .div(lpTotalSupply)
    .sub(1);

  const positionAfterWithdrawal = positionSizeToReduce.add(withdrawnBaseTokens);

  return await deriveReduceProposedAmount(positionAfterWithdrawal, market);
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

  await (await token.approve(user.vault.address, tokenAmount)).wait();
  await (
    await user.clearingHouse.provideLiquidity(0, tokenAmount, token.address)
  ).wait();
}

// withdraw liquidity
export async function withdrawLiquidityAndSettle(
  user: User,
  token: IERC20Metadata
): Promise<void> {
  const userLpPosition = await user.perpetual.getLpPosition(user.address);

  const proposedAmount = await liquidityProviderProposedAmount(
    userLpPosition,
    user.market
  );

  const closeProposedAmount = ethers.utils.parseEther('1');
  await user.clearingHouse.removeLiquidity(
    0,
    userLpPosition.liquidityBalance,
    closeProposedAmount,
    proposedAmount,
    0,
    token.address
  );
  const positionAfter = await user.perpetual.getLpPosition(user.address);

  if (positionAfter.liquidityBalance.gt(0)) {
    throw 'Liquidity not withdrawn';
  }
}

/* ********************************* */
/*          Trader operations        */
/* ********************************* */

// deposit collateral  with 18 decimals
export async function deposit(
  user: User,
  token: IERC20Metadata,
  depositAmount: BigNumber
): Promise<void> {
  // get liquidity amount in USD
  const tokenAmount = await wadToToken(await token.decimals(), depositAmount);
  await _checkTokenBalance(user, token, tokenAmount);

  await (await user.usdc.approve(user.vault.address, tokenAmount)).wait();

  await (
    await user.clearingHouse.deposit(0, tokenAmount, user.usdc.address)
  ).wait();
}

export async function withdrawCollateral(
  user: User,
  token: IERC20Metadata
): Promise<void> {
  const userDeposits = await user.vault.getTraderReserveValue(0, user.address);
  await (
    await user.clearingHouse.withdraw(0, userDeposits, token.address)
  ).wait();
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

  await (await user.usdc.approve(user.vault.address, tokenAmount)).wait();

  await (
    await user.clearingHouse.extendPositionWithCollateral(
      0,
      tokenAmount,
      token.address,
      positionAmount,
      direction,
      0
    )
  ).wait();
}

// close a position
export async function closePosition(
  user: User,
  token: IERC20Metadata
): Promise<void> {
  const traderPosition = await user.perpetual.getTraderPosition(user.address);

  const direction = traderPosition.positionSize.gt(0) ? Side.Long : Side.Short;
  let proposedAmount;
  if (direction === Side.Long) {
    proposedAmount = traderPosition.positionSize;
  } else {
    proposedAmount = await deriveCloseProposedAmount(
      traderPosition,
      user.market
    );
  }

  const fullReductionRatio = ethers.utils.parseEther('1');
  await (
    await user.clearingHouse.reducePosition(
      0,
      fullReductionRatio,
      proposedAmount,
      0
    )
  ).wait();

  await withdrawCollateral(user, token);
}

/* ********************************* */
/*       Helper operations           */
/* ********************************* */

// Returns a proposed amount precise enough to reduce a LONG or SHORT position
export async function deriveCloseProposedAmount(
  position: UserPositionStructOutput,
  market: CurveCryptoSwap2ETH
): Promise<BigNumber> {
  return deriveReduceProposedAmount(position.positionSize, market);
}

// Returns a proposed amount precise enough to reduce a LONG or SHORT position
export async function deriveReduceProposedAmount(
  positionSizeToReduce: BigNumber,
  market: CurveCryptoSwap2ETH
): Promise<BigNumber> {
  if (positionSizeToReduce.gte(0)) {
    return positionSizeToReduce;
  } else {
    return (
      await TEST_get_exactOutputSwap(
        market,
        positionSizeToReduce.abs(),
        ethers.constants.MaxUint256,
        0,
        1
      )
    ).amountIn;
  }
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
