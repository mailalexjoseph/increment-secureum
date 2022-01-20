// typechain objects
import {CryptoSwap} from '../../contracts-vyper/typechain/CryptoSwap';
import {CurveTokenV5} from '../../contracts-vyper/typechain/CurveTokenV5';

// utils
import {BigNumber} from '../../helpers/types';
import {asBigNumber} from './utils/calculations';
import {ethers} from 'hardhat';

/// @notice returns the amount of tokens transferred back to the user
export async function TEST_get_remove_liquidity(
  market: CryptoSwap,
  _amount: BigNumber,
  min_amounts: [BigNumber, BigNumber]
): Promise<[BigNumber, BigNumber]> {
  const [amountReturned] = await calcRemoveLiquidity(
    market,
    _amount,
    min_amounts
  );
  return amountReturned;
}

/// @notice returns the amount of tokens remaining in the market
export async function TEST_dust_remove_liquidity(
  market: CryptoSwap,
  _amount: BigNumber,
  min_amounts: [BigNumber, BigNumber]
): Promise<[BigNumber, BigNumber]> {
  const [, amountRemaining] = await calcRemoveLiquidity(
    market,
    _amount,
    min_amounts
  );
  return amountRemaining;
}

/// @notice returns the amount of tokens transferred back to the user
export async function TEST_get_dy(
  market: CryptoSwap,
  i: number,
  j: number,
  dx: BigNumber
): Promise<BigNumber> {
  /*
    print the results of the get_dy function line by line
  */
  if (i == j) throw new Error('i==j');
  if (i > 2 || j > 2) throw new Error('i or j > 2');

  const [PRECISION, PRECISIONS, price_scale] = await getParameterization(
    market
  );

  const [xp, y] = await calcNewPoolBalances(
    market,
    dx,
    i,
    j,
    PRECISION,
    PRECISIONS,
    price_scale
  );

  let dy = await calcOutToken(j, xp, y, PRECISION, PRECISIONS, price_scale);

  dy = await applyFees(market, xp, dy);

  return dy;
}

/// @notice returns the amount of tokens transferred back to the user

export async function TEST_get_dy_fees(
  market: CryptoSwap,
  i: number,
  j: number,
  dx: BigNumber
): Promise<BigNumber> {
  /*
    print the results of the get_dy function line by line
  */
  if (i == j) throw new Error('i==j');
  if (i > 2 || j > 2) throw new Error('i or j > 2');

  const [PRECISION, PRECISIONS, price_scale] = await getParameterization(
    market
  );

  const [xp, y] = await calcNewPoolBalances(
    market,
    dx,
    i,
    j,
    PRECISION,
    PRECISIONS,
    price_scale
  );

  const dy = await calcOutToken(j, xp, y, PRECISION, PRECISIONS, price_scale);

  const fees = await calcFees(market, xp, dy);

  return fees;
}

/// @notice returns the output of a exactOutputSwap
export async function TEST_get_exactOutputSwap(
  market: CryptoSwap,
  eAmountOut: BigNumber,
  amountInMaximum: BigNumber
): Promise<void> {
  // getter function to equivalent: https://docs.uniswap.org/protocol/guides/swaps/single-swaps#exact-output-swaps
  /*
            uint256 amount = market.get_dy(VBASE_INDEX, VQUOTE_INDEX, position);
            uint256 vBaseProceeds = market.exchange(VBASE_INDEX, VQUOTE_INDEX, amount, 0);

            console.log("vBaseProceeds:", vBaseProceeds);
            console.log("position:", position);

            require(vBaseProceeds == position, "Not enough returned");
            vQuoteProceeds = -amount.toInt256();
          */

  console.log('eAmountOut:', eAmountOut.toString());

  const inIndex = 0;
  const outIndex = 1;

  // equation 1: how much would you get for selling the vBase token right now?
  const inAmount = await market.get_dy(outIndex, inIndex, eAmountOut);

  console.log('inAmount:', inAmount.toString());
  if (inAmount.gt(amountInMaximum)) throw new Error('Too much required');

  // fees paid for first dy
  const feesPayedIn = await TEST_get_dy_fees(
    market,
    outIndex,
    inIndex,
    eAmountOut
  );
  console.log('feesPayedIn:', feesPayedIn.toString());

  const inAmountInclFees = inAmount.add(feesPayedIn);
  console.log('inAmountInclFees:', inAmountInclFees.toString());

  // fees paid for second dy
  const feesPayedOut = await TEST_get_dy_fees(
    market,
    inIndex,
    outIndex,
    inAmountInclFees
  );
  console.log('feesPayedOut:', feesPayedOut.toString());

  // equation 2: buy vBase according to equation 1)
  const outAmountInclFees = (
    await market.get_dy(inIndex, outIndex, inAmountInclFees)
  ).add(feesPayedOut);

  console.log('outAmountInclFees:', outAmountInclFees.toString());

  // log the final result
  const deltaInclFees = outAmountInclFees.sub(eAmountOut);
  console.log('deltaInclFees:', deltaInclFees.toString());

  const deltaPercentInclFees = deltaInclFees
    .mul(asBigNumber('1'))
    .div(eAmountOut)
    .mul(ethers.BigNumber.from(100));
  console.log(
    'deltaInclFees % is',
    ethers.utils.formatEther(deltaPercentInclFees)
  );
}
/*


883319625884063498   - inAmount

     444707207612999 - feesPayed

 1000000000000000000 - eAmountOut

  998996826699080839 - outAmount
   -1003173300919161 - delta:

  999499771534544348 - outAmountInclFees
    -500228465455652 - deltaInclFees


*/

/******************* HELPER FUNCTIONS  *******************/
async function calcRemoveLiquidity(
  market: CryptoSwap,
  _amount: BigNumber,
  min_amounts: [BigNumber, BigNumber]
): Promise<[[BigNumber, BigNumber], [BigNumber, BigNumber]]> {
  const amountReturned: [BigNumber, BigNumber] = [
    BigNumber.from(0),
    BigNumber.from(0),
  ];
  const amountRemaining: [BigNumber, BigNumber] = [
    BigNumber.from(0),
    BigNumber.from(0),
  ];

  let d_balance: BigNumber;
  const balances = [await market.balances(0), await market.balances(1)];
  const amount = _amount.sub(1);
  const totalSupply = await curveTotalSupply(market);

  for (let i = 0; i < 2; i++) {
    d_balance = amount.mul(balances[i]).div(totalSupply);
    if (d_balance.lt(min_amounts[i])) throw new Error('MIN_AMOUNT_NOT_MET');
    amountReturned[i] = d_balance;
    amountRemaining[i] = balances[i].sub(d_balance);
  }
  return [amountReturned, amountRemaining];
}

async function curveTotalSupply(market: CryptoSwap): Promise<BigNumber> {
  const curveTokenAddress = await market.token();
  const curveLPtoken: CurveTokenV5 = await ethers.getContractAt(
    'CurveTokenV5',
    curveTokenAddress
  );
  return await curveLPtoken.totalSupply();
}

async function calcFees(
  market: CryptoSwap,
  xp: BigNumber[],
  dy: BigNumber
): Promise<BigNumber> {
  // line: 861
  const fee = await market.fee_test([xp[0], xp[1]]);
  // console.log('fee', fee.toString());
  const fee_applied = fee.mul(dy).div(10 ** 10);
  // console.log('fee_applied', fee_applied.toString());
  return fee_applied;
}
async function applyFees(
  market: CryptoSwap,
  xp: BigNumber[],
  dy: BigNumber
): Promise<BigNumber> {
  dy = dy.sub(await calcFees(market, xp, dy));
  // console.log('dy', dy.toString());
  // console.log('end of get_dy(, i, j, dx, )');
  return dy;
}

async function calcOutToken(
  j: number,
  xp: BigNumber[],
  y: BigNumber,
  PRECISION: BigNumber,
  PRECISIONS: BigNumber[],
  price_scale: BigNumber
): Promise<BigNumber> {
  // line: 855
  let dy;
  dy = xp[j].sub(y).sub(1);
  // console.log('dy', dy.toString());

  // line: 856
  xp[j] = y;
  // console.log('xp[j]', xp[j].toString());

  // line: 857
  if (j > 0) {
    // line: 858
    dy = dy.mul(PRECISION).div(price_scale);
    // console.log('buy base , sell quote');
    // console.log('dy', dy.toString());
  } else {
    // line: 860
    dy = dy.div(PRECISIONS[0]);
    // console.log('buy quote , sell base');
    // console.log('dy', dy.toString());
  }
  return dy;
}

async function calcNewPoolBalances(
  market: CryptoSwap,
  dx: BigNumber,
  i: number,
  j: number,
  PRECISION: BigNumber,
  PRECISIONS: BigNumber[],
  price_scale: BigNumber
): Promise<[BigNumber[], BigNumber]> {
  // line: 844
  let xp;
  xp = [await market.balances(0), await market.balances(1)];
  // console.log('xp', xp.toString());

  // line: 846
  const A_gamma = await market.A_gamma_test();
  // console.log('A_gamma', A_gamma.toString());

  // line: 847
  let D;
  D = await market.D();
  // console.log('D', D.toString());

  // line: 848
  const future_A_gamma_time = await market.future_A_gamma_time();
  // console.log('future_A_gamma_time', future_A_gamma_time.toString());
  if (future_A_gamma_time.gt(0)) {
    // line: 849
    const xp_tmp = await market.xp_test();
    D = await market.newton_D_test(A_gamma[0], A_gamma[1], xp_tmp);
    throw new Error('Not tested yet');
  }

  // line: 851
  xp[i] = xp[i].add(dx);
  // console.log('xp', xp.toString());

  // line: 852
  xp = [xp[0].mul(PRECISIONS[0]), xp[1].mul(price_scale).div(PRECISION)]; // price weighted amount
  // console.log('xp', xp.toString());

  // line: 854
  const y = await market.newton_y_test(
    A_gamma[0],
    A_gamma[1],
    [xp[0], xp[1]],
    D,
    j
  );
  return [xp, y];
}

async function getParameterization(
  market: CryptoSwap
): Promise<[BigNumber, BigNumber[], BigNumber]> {
  const PRECISION = asBigNumber('1');
  const PRECISIONS = [BigNumber.from(1), BigNumber.from(1)];
  const price_scale = (await market.price_scale()).mul(PRECISIONS[1]);

  return [PRECISION, PRECISIONS, price_scale];
}

// function logConfiguration(
//   i: number,
//   j: number,
//   dx: BigNumber,
//   y: BigNumber,
//   PRECISION: BigNumber,
//   price_scale: BigNumber
// ): void {
//   console.log('get_dy(, i, j, dx)');
//   console.log('i: ', i.toString(), 'j: ', j.toString(), 'dx: ', dx.toString());
//   console.log('PRECISION: ', PRECISION.toString());
//   console.log('price_scale', price_scale.toString());
//   console.log('y', y.toString());
// }
