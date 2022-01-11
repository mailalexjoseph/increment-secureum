// typechain objects
import {CryptoSwap} from '../../../contracts-vyper/typechain/CryptoSwap';
import {CurveTokenV5} from '../../../contracts-vyper/typechain/CurveTokenV5';

// utils
import {BigNumber} from '../../../helpers/types';
import {asBigNumber} from './utils/calculations';
import {ethers} from 'hardhat';

export async function TEST_get_remove_liquidity(
  market: CryptoSwap,
  _amount: BigNumber,
  min_amounts: [BigNumber, BigNumber]
): Promise<[BigNumber, BigNumber]> {
  const amountReturned: [BigNumber, BigNumber] = [
    BigNumber.from(0),
    BigNumber.from(0),
  ];
  let d_balance: BigNumber;

  const curveTokenAddress = await market.token();
  const curveLPtoken: CurveTokenV5 = await ethers.getContractAt(
    'CurveTokenV5',
    curveTokenAddress
  );
  const totalSupply = await curveLPtoken.totalSupply();
  const balances = [await market.balances(0), await market.balances(1)];
  const amount = _amount.sub(1);

  for (let i = 0; i < 2; i++) {
    d_balance = amount.mul(balances[i]).div(totalSupply);
    if (d_balance.lt(min_amounts[i])) throw new Error('MIN_AMOUNT_NOT_MET');
    amountReturned[i] = d_balance;
  }
  return amountReturned;
}

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

function logConfiguration(
  i: number,
  j: number,
  dx: BigNumber,
  y: BigNumber,
  PRECISION: BigNumber,
  price_scale: BigNumber
): void {
  console.log('get_dy(, i, j, dx)');
  console.log('i: ', i.toString(), 'j: ', j.toString(), 'dx: ', dx.toString());
  console.log('PRECISION: ', PRECISION.toString());
  console.log('price_scale', price_scale.toString());
  console.log('y', y.toString());
}
