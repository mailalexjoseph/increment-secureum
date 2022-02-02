import {expect} from 'chai';
import {ethers, deployments, getNamedAccounts} from 'hardhat';
import env = require('hardhat');

// typechain objects
import {CryptoSwap} from '../../contracts-vyper/typechain/CryptoSwap';
import {CurveTokenV5} from '../../contracts-vyper/typechain/CurveTokenV5';
import {VBase, VQuote, VirtualToken} from '../../typechain';

// utils
import {asBigNumber, rDiv} from '../helpers/utils/calculations';
import {MAX_UINT_AMOUNT} from '../../helpers/constants';
import {
  TEST_get_dy,
  TEST_get_remove_liquidity,
  TEST_dust_remove_liquidity,
  TEST_get_exactOutputSwap,
} from '../helpers/CurveUtils';
import {getCryptoSwapConstructorArgs} from '../../helpers/contracts-deployments';
import {setupUser} from '../../helpers/misc-utils';
import {tEthereumAddress, BigNumber} from '../../helpers/types';

import {VBase__factory, VQuote__factory} from '../../typechain';
import {CurveTokenV5__factory} from '../../contracts-vyper/typechain/factories/CurveTokenV5__factory';
import {CryptoSwap__factory} from '../../contracts-vyper/typechain/factories/CryptoSwap__factory';

type User = {address: string} & {
  vBase: VBase;
  vQuote: VQuote;
  market: CryptoSwap;
  curveToken: CurveTokenV5;
};

interface TestEnv {
  deployer: User;
  trader: User;
  lp: User;
  lpTwo: User;
  marketA: tEthereumAddress;
  vBaseA: tEthereumAddress;
  vQuoteA: tEthereumAddress;
  curveTokenA: tEthereumAddress;
}

// fixed initial price
const initialPrice = ethers.utils.parseEther('1.131523');

// setup function w/ snapshots
const setup = deployments.createFixture(async (): Promise<TestEnv> => {
  const {lp, lpTwo, trader, deployer} = await getNamedAccounts();
  console.log(`Current network is ${env.network.name.toString()}`);

  const [DEPLOYER] = await ethers.getSigners();
  // deploy vBase & vQuote
  const VBaseFactory = new VBase__factory(DEPLOYER);
  const vBase = await VBaseFactory.deploy('Long EUR/USD', 'vBase');

  const VQuoteFactory = new VQuote__factory(DEPLOYER);
  const vQuote = await VQuoteFactory.deploy('Short EUR/USD', 'vQuote');

  // deploy curve token
  const CurveTokenV5Factory = new CurveTokenV5__factory(DEPLOYER);
  const curveToken = await CurveTokenV5Factory.deploy('vBase/vQuote', 'EURUSD');

  // deploy curve pool
  const FundingFactory = new CryptoSwap__factory(DEPLOYER);

  console.log(
    'Use FIXED EUR/USD price of ',
    env.ethers.utils.formatEther(initialPrice)
  );
  // deploy CryptoSwap
  const cryptoSwapConstructorArgs = getCryptoSwapConstructorArgs(
    deployer,
    initialPrice,
    curveToken.address,
    vQuote.address,
    vBase.address
  );
  const cryptoSwap = await FundingFactory.deploy(
    cryptoSwapConstructorArgs.owner,
    cryptoSwapConstructorArgs.admin_fee_receiver,
    cryptoSwapConstructorArgs.A,
    cryptoSwapConstructorArgs.gamma,
    cryptoSwapConstructorArgs.mid_fee,
    cryptoSwapConstructorArgs.out_fee,
    cryptoSwapConstructorArgs.allowed_extra_profit,
    cryptoSwapConstructorArgs.fee_gamma,
    cryptoSwapConstructorArgs.adjustment_step,
    cryptoSwapConstructorArgs.admin_fee,
    cryptoSwapConstructorArgs.ma_half_time,
    cryptoSwapConstructorArgs.initial_price,
    cryptoSwapConstructorArgs.curve_token,
    cryptoSwapConstructorArgs.reserve_tokens
  );

  // transfer minter role to curve pool
  await curveToken.set_minter(cryptoSwap.address);

  console.log('We have deployed vBase/vQuote curve pool');

  const contracts = {
    market: <CryptoSwap>cryptoSwap,
    vBase: <VBase>vBase,
    vQuote: <VQuote>vQuote,
    curveToken: <CurveTokenV5>curveToken,
  };

  // container
  const testEnv: TestEnv = {
    deployer: await setupUser(deployer, contracts),
    trader: await setupUser(trader, contracts),
    lp: await setupUser(lp, contracts),
    lpTwo: await setupUser(lpTwo, contracts),
    vBaseA: vBase.address,
    vQuoteA: vQuote.address,
    curveTokenA: curveToken.address,
    marketA: cryptoSwap.address,
  };

  return testEnv;
});

/**************** TESTS START HERE ****************************/

describe('Cryptoswap: Unit tests', function () {
  // contract and accounts
  let deployer: User, lp: User, trader: User, lpTwo: User;

  let marketA: tEthereumAddress,
    vBaseA: tEthereumAddress,
    vQuoteA: tEthereumAddress,
    curveTokenA: tEthereumAddress;

  // constants
  const MIN_MINT_AMOUNT = ethers.BigNumber.from(0);

  beforeEach(async () => {
    ({deployer, lp, lpTwo, trader, marketA, vBaseA, vQuoteA, curveTokenA} =
      await setup());
  });

  async function mintAndBuyToken(
    user: User,
    inIndex: number,
    inToken: VirtualToken, // TODO: remove this and get token via market.coins(inIndex)
    amount: BigNumber
  ): Promise<void> {
    await mintAndApprove(inToken, amount, user.address, user.market.address);

    await _buyToken(user.market, inIndex, amount);
  }

  async function _buyToken(
    market: CryptoSwap,
    inIndex: number,
    amount: BigNumber
  ) {
    if (inIndex > 1) throw new Error('out of range');

    const outIndex = inIndex === 0 ? 1 : 0;
    await market['exchange(uint256,uint256,uint256,uint256)'](
      inIndex,
      outIndex,
      amount,
      MIN_MINT_AMOUNT
    );
  }

  async function fundCurvePool(
    user: User,
    quoteAmount: BigNumber
  ): Promise<void> {
    // mint tokens
    const baseAmount = await prepareCurveTokens(user, quoteAmount);
    await user.market['add_liquidity(uint256[2],uint256)'](
      [quoteAmount, baseAmount],
      MIN_MINT_AMOUNT
    );
  }

  async function prepareCurveTokens(
    user: User,
    quoteAmount: BigNumber
  ): Promise<BigNumber> {
    const baseAmount = rDiv(quoteAmount, await user.market.price_oracle());

    await mintAndApprove(
      user.vBase,
      baseAmount,
      user.address,
      user.market.address
    );
    await mintAndApprove(
      user.vQuote,
      quoteAmount,
      user.address,
      user.market.address
    );

    return baseAmount;
  }

  async function mintAndApprove(
    token: VirtualToken,
    amount: BigNumber,
    owner: tEthereumAddress,
    spender: tEthereumAddress
  ): Promise<void> {
    const [minter] = await ethers.getSigners();
    expect(minter.address).to.be.equal(await token.owner());
    await token.connect(minter).mint(amount);

    await token.connect(minter).transfer(owner, amount);
    await token.approve(spender, amount);

    expect(await token.allowance(owner, spender)).to.be.equal(amount);
  }
  describe('Init', function () {
    it('Initialize parameters correctly', async function () {
      const {
        owner,
        A,
        gamma,
        mid_fee,
        out_fee,
        allowed_extra_profit,
        fee_gamma,
        admin_fee,
        ma_half_time,
        adjustment_step,
        initial_price,
      } = getCryptoSwapConstructorArgs(
        deployer.address,
        initialPrice,
        curveTokenA,
        vQuoteA,
        vBaseA
      );

      // coins
      expect(await deployer.market.coins(0)).to.be.equal(vQuoteA);
      expect(await deployer.market.coins(1)).to.be.equal(vBaseA);
      expect(await deployer.curveToken.minter()).to.be.equal(marketA);
      expect(await deployer.market.token()).to.be.equal(curveTokenA);

      // constructor parameters
      expect(await deployer.market.owner()).to.be.equal(owner);
      expect(await deployer.market.A()).to.be.equal(A);
      expect(await deployer.market.gamma()).to.be.equal(gamma);

      expect(await deployer.market.mid_fee()).to.be.equal(mid_fee);
      expect(await deployer.market.out_fee()).to.be.equal(out_fee);
      expect(await deployer.market.allowed_extra_profit()).to.be.equal(
        allowed_extra_profit
      );
      expect(await deployer.market.fee_gamma()).to.be.equal(fee_gamma);
      expect(await deployer.market.adjustment_step()).to.be.equal(
        adjustment_step
      );
      expect(await deployer.market.admin_fee()).to.be.equal(admin_fee);
      expect(await deployer.market.ma_half_time()).to.be.equal(ma_half_time);

      expect(await deployer.market.price_scale()).to.be.equal(initial_price);
      expect(await deployer.market.price_oracle()).to.be.equal(initial_price);
      expect(await deployer.market.last_prices()).to.be.equal(initial_price);

      // global parameters
      expect(await deployer.market.is_killed()).to.be.false;
    });
  });
  describe('Liquidity', function () {
    it('Can provide liquidity', async function () {
      // mint tokens
      const quoteAmount = asBigNumber('10');
      const baseAmount = await prepareCurveTokens(lp, quoteAmount);

      expect(await lp.vQuote.balanceOf(lp.address)).be.equal(quoteAmount);
      expect(await lp.vQuote.allowance(lp.address, marketA)).be.equal(
        quoteAmount
      );
      expect(await lp.vBase.balanceOf(lp.address)).be.equal(baseAmount);
      expect(await lp.vBase.allowance(lp.address, marketA)).be.equal(
        baseAmount
      );

      // provide liquidity
      await expect(
        lp.market['add_liquidity(uint256[2],uint256)'](
          [quoteAmount, baseAmount],
          MIN_MINT_AMOUNT
        )
      )
        .to.emit(lp.market, 'AddLiquidity')
        .withArgs(lp.address, [quoteAmount, baseAmount], 0, 0);

      expect(await lp.market.balances(0)).to.be.equal(quoteAmount);
      expect(await lp.market.balances(1)).to.be.equal(baseAmount);
      expect(await lp.vBase.balanceOf(marketA)).to.be.equal(baseAmount);
      expect(await lp.vQuote.balanceOf(marketA)).to.be.equal(quoteAmount);
      expect(await lp.curveToken.balanceOf(lp.address)).to.be.above(
        await lp.market.calc_token_amount([quoteAmount, baseAmount])
      );
    });

    it('Can not provide zero liquidity', async function () {
      // provide liquidity
      await expect(
        lp.market['add_liquidity(uint256[2],uint256)']([0, 0], 0)
      ).to.be.revertedWith('');
      /*
    "" == "Error: Transaction reverted without a reason string"
    (see. https://ethereum.stackexchange.com/questions/48627/how-to-catch-revert-error-in-truffle-test-javascript)
    */
    });

    it('Can withdraw liquidity', async function () {
      // mint tokens
      const quoteAmount = asBigNumber('10');
      const baseAmount = await prepareCurveTokens(lp, quoteAmount);

      await lp.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );

      const lpTokenBalance = await lp.curveToken.balanceOf(lp.address);
      expect(lpTokenBalance).to.be.above(0);

      // remaining balances
      const dust = await TEST_dust_remove_liquidity(lp.market, lpTokenBalance, [
        MIN_MINT_AMOUNT,
        MIN_MINT_AMOUNT,
      ]);
      expect(dust.quote).to.be.equal(2); // quoteDust is 2 (amount is above lpTokenBalance)
      expect(dust.base).to.be.equal(1); // baseDust is 1
      const remainingBalances = [quoteAmount.sub('2'), baseAmount.sub('1')];

      // withdraw liquidity
      await expect(
        lp.market['remove_liquidity(uint256,uint256[2])'](
          lpTokenBalance,
          [0, 0]
        )
      )
        .to.emit(lp.market, 'RemoveLiquidity')
        .withArgs(lp.address, remainingBalances, 0);
    });

    it('Can not withdraw 0 liquidity', async function () {
      // mint tokens
      const quoteAmount = asBigNumber('10');
      const baseAmount = await prepareCurveTokens(lp, quoteAmount);

      await await lp.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );
      // remove liquidity
      await expect(
        lp.market['remove_liquidity(uint256,uint256[2])'](0, [
          MIN_MINT_AMOUNT,
          MIN_MINT_AMOUNT,
        ])
      ).to.be.revertedWith('');
      /*
    "" == "Error: Transaction reverted without a reason string"
    (see. https://ethereum.stackexchange.com/questions/48627/how-to-catch-revert-error-in-truffle-test-javascript)
    */
    });

    it('Can deposit liquidity twice', async function () {
      // mint tokens
      const quoteAmount = asBigNumber('10');
      const baseAmount = rDiv(quoteAmount, await lp.market.price_oracle());
      await mintAndApprove(lp.vQuote, quoteAmount.mul(2), lp.address, marketA);
      await mintAndApprove(lp.vBase, quoteAmount.mul(2), lp.address, marketA);

      await lp.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );
      await lp.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );

      expect(await lp.market.balances(0)).to.be.equal(quoteAmount.mul(2));
      expect(await lp.market.balances(1)).to.be.equal(baseAmount.mul(2));
      expect(await lp.vBase.balanceOf(marketA)).to.be.equal(baseAmount.mul(2));
      expect(await lp.vQuote.balanceOf(marketA)).to.be.equal(
        quoteAmount.mul(2)
      );
    });
  });
  describe('Trading', function () {
    it('Can call dy on quoteToken', async function () {
      await fundCurvePool(lp, asBigNumber('10'));

      const dx = asBigNumber('1');
      await mintAndApprove(trader.vQuote, dx, trader.address, marketA);
      const expectedResult = await TEST_get_dy(trader.market, 0, 1, dx);
      const result = await trader.market.get_dy(0, 1, dx);
      expect(result).to.be.equal(expectedResult);
    });

    it('Can call dy on baseToken', async function () {
      await fundCurvePool(lp, asBigNumber('10'));

      const dx = asBigNumber('1');
      await mintAndApprove(trader.vBase, dx, trader.address, marketA);
      const expectedResult = await TEST_get_dy(trader.market, 1, 0, dx);
      const result = await trader.market.get_dy(1, 0, dx);
      expect(result).to.be.equal(expectedResult);
    });

    it('Can exchange quote for base token, emit event', async function () {
      await fundCurvePool(lp, asBigNumber('10000'));

      // mint tokens to trade
      const sellQuoteAmount = asBigNumber('100');
      await mintAndApprove(
        trader.vQuote,
        sellQuoteAmount,
        trader.address,
        marketA
      );

      // trade some tokens
      const eBuyBaseAmount = await trader.market.get_dy(0, 1, sellQuoteAmount);
      await expect(
        trader.market['exchange(uint256,uint256,uint256,uint256)'](
          0,
          1,
          sellQuoteAmount,
          MIN_MINT_AMOUNT
        )
      )
        .to.emit(trader.market, 'TokenExchange')
        .withArgs(trader.address, 0, sellQuoteAmount, 1, eBuyBaseAmount);

      // check balances after trade
      expect(await trader.vBase.balanceOf(trader.address)).to.be.equal(
        eBuyBaseAmount
      );
    });

    it('Can exchange base for quote token, emit event', async function () {
      await fundCurvePool(lp, asBigNumber('10'));

      // mint tokens to trade
      const sellBaseAmount = asBigNumber('1');
      await mintAndApprove(
        trader.vBase,
        sellBaseAmount,
        trader.address,
        marketA
      );

      // trade some tokens
      const eBuyQuoteAmount = await trader.market.get_dy(1, 0, sellBaseAmount);
      await expect(
        trader.market['exchange(uint256,uint256,uint256,uint256)'](
          1,
          0,
          sellBaseAmount,
          MIN_MINT_AMOUNT
        )
      )
        .to.emit(trader.market, 'TokenExchange')
        .withArgs(trader.address, 1, sellBaseAmount, 0, eBuyQuoteAmount);

      // check balances after trade
      expect(await trader.vQuote.balanceOf(trader.address)).to.be.equal(
        eBuyQuoteAmount
      );
    });
    it('Can perform (approximated) Exact Output Swap for Base', async function () {
      /* init */
      await fundCurvePool(lp, asBigNumber('1000'));

      await mintAndBuyToken(trader, 1, trader.vBase, asBigNumber('1'));

      // swap for exact quote tokens
      const swapAmount = asBigNumber('1');
      const result = await TEST_get_exactOutputSwap(
        trader.market,
        swapAmount,
        MAX_UINT_AMOUNT,
        0,
        1
      );
      expect(result.amountOut).to.be.at.least(swapAmount);
      expect(await trader.market.get_dy(0, 1, result.amountIn)).to.be.equal(
        result.amountOut
      );
      //console.log('y-delta is ', result.amountOut.sub(swapAmount).toString());
    });
    it('Can perform (approximated) Exact Output Swap for Quote', async function () {
      /* init */
      await fundCurvePool(lp, asBigNumber('1000'));

      await mintAndBuyToken(trader, 1, trader.vBase, asBigNumber('1'));

      // swap for exact base tokens
      const swapAmount = asBigNumber('1');
      const result = await TEST_get_exactOutputSwap(
        trader.market,
        swapAmount,
        MAX_UINT_AMOUNT,
        1,
        0
      );
      expect(result.amountOut).to.be.at.least(swapAmount);
      expect(await trader.market.get_dy(1, 0, result.amountIn)).to.be.equal(
        result.amountOut
      );
      // console.log('y-delta is ', result.amountOut.sub(swapAmount).toString());
    });

    it('Can buy base tokens twice', async function () {
      await fundCurvePool(lp, asBigNumber('10'));

      const dx = asBigNumber('1');

      // first trade
      await mintAndBuyToken(trader, 1, trader.vBase, dx);

      const balancesVQuoteBefore = await trader.vQuote.balanceOf(
        trader.address
      );

      // second trade
      const eBuyQuoteAmount = await trader.market.get_dy(1, 0, dx);
      await mintAndBuyToken(trader, 1, trader.vBase, dx);

      // check balances after trade
      const balancesVQuoteAfter = await trader.vQuote.balanceOf(trader.address);
      expect(balancesVQuoteAfter).to.be.equal(
        balancesVQuoteBefore.add(eBuyQuoteAmount)
      );
    });
  });
  describe('Liquidity & Trading', function () {
    it('Can provide liquidity after some trading', async function () {
      /* init */
      await fundCurvePool(lp, asBigNumber('10'));

      await mintAndBuyToken(trader, 1, trader.vBase, asBigNumber('1'));

      /* provide liquidity */

      // mint tokens
      const quoteAmount = asBigNumber('10');
      const baseAmount = await prepareCurveTokens(lpTwo, quoteAmount);

      expect(await lpTwo.vQuote.balanceOf(lpTwo.address)).be.equal(quoteAmount);
      expect(await lpTwo.vQuote.allowance(lpTwo.address, marketA)).be.equal(
        quoteAmount
      );
      expect(await lpTwo.vBase.balanceOf(lpTwo.address)).be.equal(baseAmount);
      expect(await lpTwo.vBase.allowance(lpTwo.address, marketA)).be.equal(
        baseAmount
      );

      const balanceQuoteBefore = await lpTwo.market.balances(0);
      const balanceBaseBefore = await lpTwo.market.balances(1);

      // provide liquidity
      await lpTwo.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );

      expect(await lpTwo.market.balances(0)).to.be.equal(
        balanceQuoteBefore.add(quoteAmount)
      );
      expect(await lpTwo.market.balances(1)).to.be.equal(
        balanceBaseBefore.add(baseAmount)
      );
      expect(await lpTwo.vBase.balanceOf(marketA)).to.be.equal(
        balanceBaseBefore.add(baseAmount)
      );
      expect(await lpTwo.vQuote.balanceOf(marketA)).to.be.equal(
        balanceQuoteBefore.add(quoteAmount)
      );
      expect(await lpTwo.curveToken.balanceOf(lpTwo.address)).to.be.above(
        await lpTwo.market.calc_token_amount([quoteAmount, baseAmount])
      );
    });
    it('Can withdraw liquidity after some trading', async function () {
      /* init */
      await fundCurvePool(lp, asBigNumber('10'));
      await mintAndBuyToken(trader, 1, trader.vBase, asBigNumber('1'));

      /* provide liquidity */

      // mint tokens
      const quoteAmount = asBigNumber('10');
      const baseAmount = await prepareCurveTokens(lp, quoteAmount);

      // provide liquidity
      await lp.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );

      /* withdraw liquidity */
      // check balances before withdrawal
      const balanceVQuoteBeforeUser = await lp.vQuote.balanceOf(lp.address);
      const balanceVBaseBeforeUser = await lp.vBase.balanceOf(lp.address);
      const balanceVQuoteBeforeMarket = await lp.vQuote.balanceOf(marketA);
      const balanceVBaseBeforeMarket = await lp.vBase.balanceOf(marketA);
      expect(balanceVQuoteBeforeUser).to.be.equal(0);
      expect(balanceVBaseBeforeUser).to.be.equal(0);

      // withdraw liquidity
      const withdrawableAmount = await lp.curveToken.balanceOf(lp.address);
      const eWithdrawAmount = await TEST_get_remove_liquidity(
        lp.market,
        withdrawableAmount,
        [MIN_MINT_AMOUNT, MIN_MINT_AMOUNT]
      );
      await lp.market['remove_liquidity(uint256,uint256[2])'](
        withdrawableAmount,
        [MIN_MINT_AMOUNT, MIN_MINT_AMOUNT]
      );

      // check balances after withdrawal
      const balanceVQuoteAfterUser = await lp.vQuote.balanceOf(lp.address);
      const balanceVBaseAfterUser = await lp.vBase.balanceOf(lp.address);
      const balanceVQuoteAfterMarket = await lp.vQuote.balanceOf(marketA);
      const balanceVBaseAfterMarket = await lp.vBase.balanceOf(marketA);

      expect(balanceVBaseBeforeMarket).to.be.equal(
        balanceVBaseAfterMarket.add(balanceVBaseAfterUser)
      );
      expect(balanceVQuoteBeforeMarket).to.be.equal(
        balanceVQuoteAfterMarket.add(balanceVQuoteAfterUser)
      );
      expect(eWithdrawAmount[0]).to.be.equal(balanceVQuoteAfterUser);
      expect(eWithdrawAmount[1]).to.be.equal(balanceVBaseAfterUser);
    });
  });
});

// async function logMarket(market: CryptoSwap, vBase: VBase, vQuote: VQuote) {
//   console.log(
//     'virtual price',
//     ethers.utils.formatEther(await market.virtual_price())
//   );
//   console.log(
//     'price oracle',
//     ethers.utils.formatEther(await market.price_oracle())
//   );
//   console.log(
//     'vQuote balance',
//     ethers.utils.formatEther(await vQuote.balanceOf(market.address))
//   );
//   console.log(
//     'vBase balance',
//     ethers.utils.formatEther(await vBase.balanceOf(market.address))
//   );
// }
