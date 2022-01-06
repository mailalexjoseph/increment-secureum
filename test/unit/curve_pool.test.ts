// typechain objects
import {CryptoSwap} from '../../contracts-vyper/typechain/CryptoSwap';
import {CurveTokenV5} from '../../contracts-vyper/typechain/CurveTokenV5';
import {CryptoSwap__factory} from '../../contracts-vyper/typechain/factories/CryptoSwap__factory';
import {CurveTokenV5__factory} from '../../contracts-vyper/typechain/factories/CurveTokenV5__factory';
import {VBase, VQuote, VirtualToken} from '../../typechain';
import {VBase__factory, VQuote__factory} from '../../typechain';

// utils
import {ethers, getUnnamedAccounts} from 'hardhat';
import {rDiv} from '../integration/helpers/utils/calculations';
import {
  TEST_get_dy,
  TEST_get_remove_liquidity,
} from '../integration/helpers/CurveUtils';
import {getCryptoSwapConstructorArgs} from '../../helpers/contracts-deployments';
import {setupUsers} from '../../helpers/misc-utils';
import {tEthereumAddress, BigNumber} from '../../helpers/types';

import chaiModule = require('../chai-setup');
const {expect} = chaiModule;

const MIN_MINT_AMOUNT = ethers.BigNumber.from(0);

type User = {address: string} & {
  vBase: VBase;
  vQuote: VQuote;
  market: CryptoSwap;
  curveToken: CurveTokenV5;
};

async function buyVBaseAndBurn(
  market: CryptoSwap,
  vBase: VBase,
  vQuote: VQuote,
  from: tEthereumAddress
): Promise<void> {
  const quoteAmount = ethers.utils.parseEther('10');
  await mintAndApprove(vQuote, quoteAmount, from, market.address);

  await market['exchange(uint256,uint256,uint256,uint256)'](
    0,
    1,
    quoteAmount,
    MIN_MINT_AMOUNT
  );
  // burn all vBase from user
  vBase.burn(await vBase.balanceOf(from));
}

async function fundCurvePool(
  market: CryptoSwap,
  vBase: VBase,
  vQuote: VQuote,
  from: tEthereumAddress,
  quoteAmount: BigNumber
): Promise<void> {
  // mint tokens
  const baseAmount = await mintCurveTokens(
    market,
    vBase,
    vQuote,
    from,
    quoteAmount
  );
  await market['add_liquidity(uint256[2],uint256)'](
    [quoteAmount, baseAmount],
    MIN_MINT_AMOUNT
  );
}

async function mintCurveTokens(
  market: CryptoSwap,
  vBase: VBase,
  vQuote: VQuote,
  from: tEthereumAddress,
  quoteAmount: BigNumber
): Promise<BigNumber> {
  // mint tokens
  const baseAmount = rDiv(quoteAmount, await market.price_oracle());
  await mintAndApprove(vBase, baseAmount, from, market.address);
  await mintAndApprove(vQuote, quoteAmount, from, market.address);
  return baseAmount;
}

async function mintAndApprove(
  token: VirtualToken,
  amount: BigNumber,
  from: tEthereumAddress,
  spender: tEthereumAddress
): Promise<void> {
  const [minter] = await ethers.getSigners();
  expect(minter.address).to.be.equal(await token.owner());
  await token.connect(minter).mint(amount);
  await token.connect(minter).transfer(from, amount);
  await token.approve(spender, amount);
}

describe('Cryptoswap: Unit tests', function () {
  // contract and accounts
  let deployer: User,
    liquidityProviderOne: User,
    traderOne: User,
    liquidityProviderTwo: User,
    traderTwo: User;

  let marketA: tEthereumAddress,
    vBaseA: tEthereumAddress,
    vQuoteA: tEthereumAddress,
    curveTokenA: tEthereumAddress;

  // constructor arguments
  let owner: tEthereumAddress, admin_fee_receiver: tEthereumAddress;
  let A: BigNumber,
    gamma: BigNumber,
    mid_fee: BigNumber,
    out_fee: BigNumber,
    allowed_extra_profit: BigNumber,
    fee_gamma: BigNumber,
    adjustment_step: BigNumber,
    admin_fee: BigNumber,
    ma_half_time: BigNumber,
    initial_price: BigNumber,
    _token: tEthereumAddress,
    _coins: [tEthereumAddress, tEthereumAddress];

  beforeEach(async () => {
    const [LIQUIDITYPROVIDERONE, LIQUIDITYPROVIDERTWO, TRADERONE, TRADERTWO] =
      await getUnnamedAccounts();

    // fund account with ether
    // await fundAccountsHardhat([DEPLOYER], env);

    // deploy vEUR & vUSD
    const [DEPLOYER] = await ethers.getSigners();
    const VBaseFactory = new VBase__factory(DEPLOYER);

    const vBase = await VBaseFactory.deploy('Long EUR/USD', 'vEUR');

    const VQuoteFactory = new VQuote__factory(DEPLOYER);
    const vQuote = await VQuoteFactory.deploy('Short EUR/USD', 'vUSD');
    // deploy curve token
    const CurveTokenV5Factory = new CurveTokenV5__factory(DEPLOYER);
    const curveToken = await CurveTokenV5Factory.deploy('vEUR/vUSD', 'EURUSD');
    // deploy curve pool
    const FundingFactory = new CryptoSwap__factory(DEPLOYER);

    // deploy cryptoswap
    const initialPrice = ethers.utils.parseEther('1.2');
    [
      owner,
      admin_fee_receiver,
      A,
      gamma,
      mid_fee,
      out_fee,
      allowed_extra_profit,
      fee_gamma,
      adjustment_step,
      admin_fee,
      ma_half_time,
      initial_price,
      _token,
      _coins,
    ] = getCryptoSwapConstructorArgs(
      DEPLOYER.address,
      initialPrice,
      curveToken.address,
      vQuote.address,
      vBase.address
    );

    const market = await FundingFactory.deploy(
      owner,
      admin_fee_receiver,
      A,
      gamma,
      mid_fee,
      out_fee,
      allowed_extra_profit,
      fee_gamma,
      adjustment_step,
      admin_fee,
      ma_half_time,
      initial_price,
      _token,
      _coins
    );

    // setup users
    [
      deployer,
      liquidityProviderOne,
      liquidityProviderTwo,
      traderOne,
      traderTwo,
    ] = await setupUsers(
      [
        await DEPLOYER.getAddress(),
        LIQUIDITYPROVIDERONE,
        LIQUIDITYPROVIDERTWO,
        TRADERONE,
        TRADERTWO,
      ],
      {
        vBase: vBase,
        vQuote: vQuote,
        market: market,
        curveToken: curveToken,
      }
    );
    // address shortcuts
    [vBaseA, vQuoteA, marketA, curveTokenA] = [
      vBase.address,
      vQuote.address,
      market.address,
      curveToken.address,
    ];

    // set curve as minter
    await deployer.curveToken.set_minter(marketA);
  });
  describe('Init', function () {
    it('Initialize parameters correctly', async function () {
      // coins
      expect(await deployer.market.coins(0)).to.be.equal(vQuoteA);
      expect(await deployer.market.coins(1)).to.be.equal(vBaseA);
      expect(await deployer.curveToken.minter()).to.be.equal(marketA);
      expect(await deployer.market.token()).to.be.equal(curveTokenA);

      // constructor parameters
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
      const quoteAmount = ethers.utils.parseEther('10');
      const baseAmount = await mintCurveTokens(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        quoteAmount
      );

      expect(
        await liquidityProviderOne.vQuote.balanceOf(
          liquidityProviderOne.address
        )
      ).be.equal(quoteAmount);
      expect(
        await liquidityProviderOne.vQuote.allowance(
          liquidityProviderOne.address,
          marketA
        )
      ).be.equal(quoteAmount);
      expect(
        await liquidityProviderOne.vBase.balanceOf(liquidityProviderOne.address)
      ).be.equal(baseAmount);
      expect(
        await liquidityProviderOne.vBase.allowance(
          liquidityProviderOne.address,
          marketA
        )
      ).be.equal(baseAmount);

      // provide liquidity
      await expect(
        liquidityProviderOne.market['add_liquidity(uint256[2],uint256)'](
          [quoteAmount, baseAmount],
          MIN_MINT_AMOUNT
        )
      )
        .to.emit(liquidityProviderOne.market, 'AddLiquidity')
        .withArgs(
          liquidityProviderOne.address,
          [quoteAmount, baseAmount],
          0,
          0
        );

      expect(await liquidityProviderOne.market.balances(0)).to.be.equal(
        quoteAmount
      );
      expect(await liquidityProviderOne.market.balances(1)).to.be.equal(
        baseAmount
      );
      expect(await liquidityProviderOne.vBase.balanceOf(marketA)).to.be.equal(
        baseAmount
      );
      expect(await liquidityProviderOne.vQuote.balanceOf(marketA)).to.be.equal(
        quoteAmount
      );
      expect(
        await liquidityProviderOne.curveToken.balanceOf(
          liquidityProviderOne.address
        )
      ).to.be.above(
        await liquidityProviderOne.market.calc_token_amount([
          quoteAmount,
          baseAmount,
        ])
      );
    });

    it('Can not provide zero liquidity', async function () {
      // provide liquidity
      await expect(
        liquidityProviderOne.market['add_liquidity(uint256[2],uint256)'](
          [0, 0],
          0
        )
      ).to.be.revertedWith('');
      /*
    "" == "Error: Transaction reverted without a reason string"
    (see. https://ethereum.stackexchange.com/questions/48627/how-to-catch-revert-error-in-truffle-test-javascript)
    */
    });

    it('Can withdraw liquidity', async function () {
      // mint tokens
      const quoteAmount = ethers.utils.parseEther('10');
      const baseAmount = await mintCurveTokens(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        quoteAmount
      );

      await liquidityProviderOne.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );

      const lpTokenBalance = await liquidityProviderOne.curveToken.balanceOf(
        liquidityProviderOne.address
      );
      expect(lpTokenBalance).to.be.above(0);

      // TODO: Why do we get this (leftover) balance?
      const remainingBalances = [
        ethers.BigNumber.from('9999999999999999998'), // 9.9999 with 18 decimals
        ethers.BigNumber.from('8333333333333333332'),
      ];
      await expect(
        liquidityProviderOne.market['remove_liquidity(uint256,uint256[2])'](
          lpTokenBalance,
          [0, 0]
        )
      )
        .to.emit(liquidityProviderOne.market, 'RemoveLiquidity')
        .withArgs(liquidityProviderOne.address, remainingBalances, 0);
    });

    it('Can not withdraw 0 liquidity', async function () {
      // mint tokens
      const quoteAmount = ethers.utils.parseEther('10');
      const baseAmount = await mintCurveTokens(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        quoteAmount
      );

      await await liquidityProviderOne.market[
        'add_liquidity(uint256[2],uint256)'
      ]([quoteAmount, baseAmount], MIN_MINT_AMOUNT);
      // remove liquidity
      await expect(
        liquidityProviderOne.market['remove_liquidity(uint256,uint256[2])'](0, [
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
      const quoteAmount = ethers.utils.parseEther('10');
      const baseAmount = rDiv(
        quoteAmount,
        await liquidityProviderOne.market.price_oracle()
      );
      await mintAndApprove(
        liquidityProviderOne.vQuote,
        quoteAmount.mul(2),
        liquidityProviderOne.address,
        marketA
      );
      await mintAndApprove(
        liquidityProviderOne.vBase,
        quoteAmount.mul(2),
        liquidityProviderOne.address,
        marketA
      );

      await liquidityProviderOne.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );
      await liquidityProviderOne.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );

      expect(await liquidityProviderOne.market.balances(0)).to.be.equal(
        quoteAmount.mul(2)
      );
      expect(await liquidityProviderOne.market.balances(1)).to.be.equal(
        baseAmount.mul(2)
      );
      expect(await liquidityProviderOne.vBase.balanceOf(marketA)).to.be.equal(
        baseAmount.mul(2)
      );
      expect(await liquidityProviderOne.vQuote.balanceOf(marketA)).to.be.equal(
        quoteAmount.mul(2)
      );
    });
  });
  describe('Trading', function () {
    it('Can call dy', async function () {
      await fundCurvePool(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        ethers.utils.parseEther('10')
      );

      const dx = ethers.utils.parseEther('1');
      await mintAndApprove(traderOne.vQuote, dx, traderOne.address, marketA);
      const expectedResult = await TEST_get_dy(traderOne.market, 0, 1, dx);
      const result = await traderOne.market.get_dy(0, 1, dx);
      expect(result).to.be.equal(expectedResult);
    });

    it('Can exchange quote for base token', async function () {
      await fundCurvePool(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        ethers.utils.parseEther('10')
      );

      // mint tokens to trade
      const sellQuoteAmount = ethers.utils.parseEther('1');
      await mintAndApprove(
        traderOne.vQuote,
        sellQuoteAmount,
        traderOne.address,
        marketA
      );

      // vQuote is 0, vBase is 1
      expect(vQuoteA).to.be.equal(await traderOne.market.coins(0));
      expect(vBaseA).to.be.equal(await traderOne.market.coins(1));

      // check balances before trade
      const balancesVQuoteBefore = await traderOne.vQuote.balanceOf(
        traderOne.address
      );
      const balanceVBaseBefore = await traderOne.vBase.balanceOf(
        traderOne.address
      );

      // trade some tokens
      const eBuyBaseAmount = await traderOne.market.get_dy(
        0,
        1,
        sellQuoteAmount
      );
      await traderOne.market['exchange(uint256,uint256,uint256,uint256)'](
        0,
        1,
        sellQuoteAmount,
        MIN_MINT_AMOUNT
      );

      // check balances after trade
      const balancesVQuoteAfter = await traderOne.vQuote.balanceOf(
        traderOne.address
      );
      const balanceVBaseAfter = await traderOne.vBase.balanceOf(
        traderOne.address
      );

      expect(balancesVQuoteAfter.add(sellQuoteAmount)).to.be.equal(
        balancesVQuoteBefore
      );
      expect(balanceVBaseAfter.sub(balanceVBaseBefore)).to.be.equal(
        eBuyBaseAmount
      );
    });

    it('Can exchange base for quote token', async function () {
      await fundCurvePool(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        ethers.utils.parseEther('10')
      );

      // mint tokens to trade
      const sellBaseAmount = ethers.utils.parseEther('1');
      await mintAndApprove(
        traderOne.vBase,
        sellBaseAmount,
        traderOne.address,
        marketA
      );

      // vQuote is 0, vBase is 1
      expect(vQuoteA).to.be.equal(await traderOne.market.coins(0));
      expect(vBaseA).to.be.equal(await traderOne.market.coins(1));

      // check balances before trade
      const balancesVQuoteBefore = await traderOne.vQuote.balanceOf(
        traderOne.address
      );
      const balanceVBaseBefore = await traderOne.vBase.balanceOf(
        traderOne.address
      );

      // trade some tokens
      const eBuyQuoteAmount = await traderOne.market.get_dy(
        1,
        0,
        sellBaseAmount
      );
      await traderOne.market['exchange(uint256,uint256,uint256,uint256)'](
        1,
        0,
        sellBaseAmount,
        MIN_MINT_AMOUNT
      );

      // check balances after trade
      const balancesVQuoteAfter = await traderOne.vQuote.balanceOf(
        traderOne.address
      );
      const balanceVBaseAfter = await traderOne.vBase.balanceOf(
        traderOne.address
      );

      expect(balanceVBaseAfter.add(sellBaseAmount)).to.be.equal(
        balanceVBaseBefore
      );
      expect(balancesVQuoteAfter.sub(balancesVQuoteBefore)).to.be.equal(
        eBuyQuoteAmount
      );
    });
  });
  describe('Liquidity & Trading', function () {
    it('Can provide liquidity after some trading', async function () {
      /* init */
      await fundCurvePool(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        ethers.utils.parseEther('10')
      );
      await buyVBaseAndBurn(
        traderOne.market,
        traderOne.vBase,
        traderOne.vQuote,
        traderOne.address
      );

      /* provide liquidity */

      // mint tokens
      const quoteAmount = ethers.utils.parseEther('10');
      const baseAmount = await mintCurveTokens(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        quoteAmount
      );

      expect(
        await liquidityProviderOne.vQuote.balanceOf(
          liquidityProviderOne.address
        )
      ).be.equal(quoteAmount);
      expect(
        await liquidityProviderOne.vQuote.allowance(
          liquidityProviderOne.address,
          marketA
        )
      ).be.equal(quoteAmount);
      expect(
        await liquidityProviderOne.vBase.balanceOf(liquidityProviderOne.address)
      ).be.equal(baseAmount);
      expect(
        await liquidityProviderOne.vBase.allowance(
          liquidityProviderOne.address,
          marketA
        )
      ).be.equal(baseAmount);

      const balanceQuoteBefore = await liquidityProviderOne.market.balances(0);
      const balanceBaseBefore = await liquidityProviderOne.market.balances(1);

      // provide liquidity
      await liquidityProviderOne.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );

      expect(await liquidityProviderOne.market.balances(0)).to.be.equal(
        balanceQuoteBefore.add(quoteAmount)
      );
      expect(await liquidityProviderOne.market.balances(1)).to.be.equal(
        balanceBaseBefore.add(baseAmount)
      );
      expect(await liquidityProviderOne.vBase.balanceOf(marketA)).to.be.equal(
        balanceBaseBefore.add(baseAmount)
      );
      expect(await liquidityProviderOne.vQuote.balanceOf(marketA)).to.be.equal(
        balanceQuoteBefore.add(quoteAmount)
      );
      expect(
        await liquidityProviderOne.curveToken.balanceOf(
          liquidityProviderOne.address
        )
      ).to.be.above(
        await liquidityProviderOne.market.calc_token_amount([
          quoteAmount,
          baseAmount,
        ])
      );
    });
    it('Can withdraw liquidity after some trading', async function () {
      /* init */
      await fundCurvePool(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        ethers.utils.parseEther('10')
      );
      await buyVBaseAndBurn(
        traderOne.market,
        traderOne.vBase,
        traderOne.vQuote,
        traderOne.address
      );

      /* provide liquidity */

      // mint tokens
      const quoteAmount = ethers.utils.parseEther('10');
      const baseAmount = await mintCurveTokens(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        quoteAmount
      );

      // provide liquidity
      await liquidityProviderOne.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );

      /* withdraw liquidity */
      // check balances before withdrawal
      const balanceVQuoteBeforeUser =
        await liquidityProviderOne.vQuote.balanceOf(
          liquidityProviderOne.address
        );
      const balanceVBaseBeforeUser = await liquidityProviderOne.vBase.balanceOf(
        liquidityProviderOne.address
      );
      const balanceVQuoteBeforeMarket =
        await liquidityProviderOne.vQuote.balanceOf(marketA);
      const balanceVBaseBeforeMarket =
        await liquidityProviderOne.vBase.balanceOf(marketA);
      expect(balanceVQuoteBeforeUser).to.be.equal(0);
      expect(balanceVBaseBeforeUser).to.be.equal(0);

      // withdraw liquidity
      const withdrawableAmount =
        await liquidityProviderOne.curveToken.balanceOf(
          liquidityProviderOne.address
        );
      const eWithdrawAmount = await TEST_get_remove_liquidity(
        liquidityProviderOne.market,
        withdrawableAmount,
        [MIN_MINT_AMOUNT, MIN_MINT_AMOUNT]
      );
      await liquidityProviderOne.market['remove_liquidity(uint256,uint256[2])'](
        withdrawableAmount,
        [MIN_MINT_AMOUNT, MIN_MINT_AMOUNT]
      );

      // check balances after withdrawal
      const balanceVQuoteAfterUser =
        await liquidityProviderOne.vQuote.balanceOf(
          liquidityProviderOne.address
        );
      const balanceVBaseAfterUser = await liquidityProviderOne.vBase.balanceOf(
        liquidityProviderOne.address
      );
      const balanceVQuoteAfterMarket =
        await liquidityProviderOne.vQuote.balanceOf(marketA);
      const balanceVBaseAfterMarket =
        await liquidityProviderOne.vBase.balanceOf(marketA);

      expect(balanceVBaseBeforeMarket).to.be.equal(
        balanceVBaseAfterMarket.add(balanceVBaseAfterUser)
      );
      expect(balanceVQuoteBeforeMarket).to.be.equal(
        balanceVQuoteAfterMarket.add(balanceVQuoteAfterUser)
      );
      expect(eWithdrawAmount[0]).to.be.equal(balanceVQuoteAfterUser);
      expect(eWithdrawAmount[1]).to.be.equal(balanceVBaseAfterUser);
    });

    it.skip('Can calculate profit of liquidity providers', async function () {
      /* init */
      await fundCurvePool(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        ethers.utils.parseEther('10')
      );

      await buyVBaseAndBurn(
        traderOne.market,
        traderOne.vBase,
        traderOne.vQuote,
        traderOne.address
      );

      // provide liquidity
      // mint tokens
      const quoteAmount = ethers.utils.parseEther('10');
      const baseAmount = await mintCurveTokens(
        liquidityProviderOne.market,
        liquidityProviderOne.vBase,
        liquidityProviderOne.vQuote,
        liquidityProviderOne.address,
        quoteAmount
      );
      await liquidityProviderTwo.market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );
      // TODO: finish this test
      // TODO: multiple liquidity providers & traders
    });
  });
});
