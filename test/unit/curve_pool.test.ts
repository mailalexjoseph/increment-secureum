// typechain objects
import {CryptoSwap} from '../../contracts-vyper/typechain/CryptoSwap';
import {CurveTokenV5} from '../../contracts-vyper/typechain/CurveTokenV5';
import {CryptoSwap__factory} from '../../contracts-vyper/typechain/factories/CryptoSwap__factory';
import {CurveTokenV5__factory} from '../../contracts-vyper/typechain/factories/CurveTokenV5__factory';
import {VBase, VQuote, VirtualToken} from '../../typechain';
import {VBase__factory, VQuote__factory} from '../../typechain';

// utils
import {Signer} from 'ethers';
import {ethers} from 'hardhat';
import env from 'hardhat';
import {rDiv} from '../integration/helpers/utils/calculations';
import {TEST_get_dy} from '../integration/helpers/CurveUtils';
import {getCryptoSwapConstructorArgs} from '../../helpers/contracts-deployments';
import {fundAccountsHardhat} from '../../helpers/misc-utils';
import {tEthereumAddress, BigNumber} from '../../helpers/types';

import chaiModule = require('../chai-setup');
const {expect} = chaiModule;

const MIN_MINT_AMOUNT = ethers.BigNumber.from(0);

async function mintAndApprove(
  token: VirtualToken,
  amount: BigNumber,
  spender: tEthereumAddress
): Promise<void> {
  expect(await token.signer.getAddress()).to.be.equal(await token.owner());
  await token.mint(amount);
  await token.approve(spender, amount);
}

async function fundCurvePool(
  market: CryptoSwap,
  vBase: VBase,
  vQuote: VQuote
): Promise<void> {
  // mint tokens
  const quoteAmount = ethers.utils.parseEther('10');
  const baseAmount = rDiv(quoteAmount, await market.price_oracle());
  await mintAndApprove(vBase, baseAmount, market.address);
  await mintAndApprove(vQuote, quoteAmount, market.address);

  await market['add_liquidity(uint256[2],uint256)'](
    [quoteAmount, baseAmount],
    MIN_MINT_AMOUNT
  );
}

async function buyVBaseAndBurn(
  market: CryptoSwap,
  vBase: VBase,
  vQuote: VQuote
): Promise<void> {
  const quoteAmount = ethers.utils.parseEther('10');
  await mintAndApprove(vQuote, quoteAmount, market.address);

  await market['exchange(uint256,uint256,uint256,uint256)'](
    0,
    1,
    quoteAmount,
    MIN_MINT_AMOUNT
  );
  // burn all vBase from deployer
  vBase.burn(await vBase.balanceOf(await vBase.signer.getAddress()));
}

describe('Cryptoswap: Unit tests', function () {
  // contract and accounts
  let deployer: Signer;
  let deployerAccount: tEthereumAddress;
  let market: CryptoSwap;
  let vBase: VBase, vQuote: VQuote;
  let curveToken: CurveTokenV5;

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
    [deployer] = await ethers.getSigners();
    deployerAccount = await deployer.getAddress();

    // fund account
    await fundAccountsHardhat([deployerAccount], env);

    // deploy vEUR & vUSD
    const VBaseFactory = new VBase__factory(deployer);
    vBase = await VBaseFactory.deploy('Long EUR/USD', 'vEUR');

    const VQuoteFactory = new VQuote__factory(deployer);
    vQuote = await VQuoteFactory.deploy('Short EUR/USD', 'vUSD');

    // deploy curve token
    const CurveTokenV5Factory = new CurveTokenV5__factory(deployer);
    curveToken = await CurveTokenV5Factory.deploy('vEUR/vUSD', 'EURUSD');

    // deploy curve pool
    const FundingFactory = new CryptoSwap__factory(deployer);

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
      deployerAccount,
      initialPrice,
      curveToken.address,
      vQuote.address,
      vBase.address
    );
    const Cryptoswap = await FundingFactory.deploy(
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
    market = Cryptoswap.connect(deployer);

    // set curve as minter
    await curveToken.connect(deployer).set_minter(market.address);
  });
  describe('Init', function () {
    it('Initialize parameters correctly', async function () {
      // coins
      expect(await market.coins(0)).to.be.equal(vQuote.address);
      expect(await market.coins(1)).to.be.equal(vBase.address);
      expect(await curveToken.minter()).to.be.equal(market.address);

      // constructor parameters
      expect(await market.A()).to.be.equal(A);
      expect(await market.gamma()).to.be.equal(gamma);

      expect(await market.mid_fee()).to.be.equal(mid_fee);
      expect(await market.out_fee()).to.be.equal(out_fee);
      expect(await market.allowed_extra_profit()).to.be.equal(
        allowed_extra_profit
      );
      expect(await market.fee_gamma()).to.be.equal(fee_gamma);
      expect(await market.adjustment_step()).to.be.equal(adjustment_step);
      expect(await market.admin_fee()).to.be.equal(admin_fee);
      expect(await market.ma_half_time()).to.be.equal(ma_half_time);

      expect(await market.price_scale()).to.be.equal(initial_price);
      expect(await market.price_oracle()).to.be.equal(initial_price);
      expect(await market.last_prices()).to.be.equal(initial_price);

      // global parameters
      expect(await market.is_killed()).to.be.false;
    });
  });
  describe('Liquidity', function () {
    it('Can provide liquidity', async function () {
      // mint tokens
      const quoteAmount = ethers.utils.parseEther('10');
      const baseAmount = rDiv(quoteAmount, await market.price_oracle());
      await mintAndApprove(vQuote, quoteAmount, market.address);
      await mintAndApprove(vBase, baseAmount, market.address);

      expect(await vQuote.balanceOf(deployerAccount)).be.equal(quoteAmount);
      expect(await vQuote.allowance(deployerAccount, market.address)).be.equal(
        quoteAmount
      );
      expect(await vBase.balanceOf(deployerAccount)).be.equal(baseAmount);
      expect(await vBase.allowance(deployerAccount, market.address)).be.equal(
        baseAmount
      );

      // provide liquidity
      await expect(
        market['add_liquidity(uint256[2],uint256)'](
          [quoteAmount, baseAmount],
          MIN_MINT_AMOUNT
        )
      )
        .to.emit(market, 'AddLiquidity')
        .withArgs(deployerAccount, [quoteAmount, baseAmount], 0, 0);

      expect(await market.balances(0)).to.be.equal(quoteAmount);
      expect(await market.balances(1)).to.be.equal(baseAmount);
      expect(await vBase.balanceOf(market.address)).to.be.equal(baseAmount);
      expect(await vQuote.balanceOf(market.address)).to.be.equal(quoteAmount);
      expect(await curveToken.balanceOf(deployerAccount)).to.be.above(0); // TODO: Calculate correct amount of minted lp tokens
    });

    it('Can not provide zero liquidity', async function () {
      // provide liquidity
      await expect(
        market['add_liquidity(uint256[2],uint256)']([0, 0], 0)
      ).to.be.revertedWith('');
      /*
    "" == "Error: Transaction reverted without a reason string"
    (see. https://ethereum.stackexchange.com/questions/48627/how-to-catch-revert-error-in-truffle-test-javascript)
    */
    });

    it('Can withdraw liquidity', async function () {
      // mint tokens
      const quoteAmount = ethers.utils.parseEther('10');
      const baseAmount = rDiv(quoteAmount, await market.price_oracle());
      await mintAndApprove(vBase, baseAmount, market.address);
      await mintAndApprove(vQuote, quoteAmount, market.address);

      await market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );

      const lpTokenBalance = await curveToken.balanceOf(deployerAccount);
      expect(lpTokenBalance).to.be.above(0);

      // TODO: Why do we get this (leftover) balance?
      const remainingBalances = [
        ethers.BigNumber.from('9999999999999999998'), // 9.9999 with 18 decimals
        ethers.BigNumber.from('8333333333333333332'),
      ];
      await expect(
        market['remove_liquidity(uint256,uint256[2])'](lpTokenBalance, [0, 0])
      )
        .to.emit(market, 'RemoveLiquidity')
        .withArgs(deployerAccount, remainingBalances, 0);
    });

    it('Can not withdraw 0 liquidity', async function () {
      // mint tokens
      const quoteAmount = ethers.utils.parseEther('10');
      const baseAmount = rDiv(quoteAmount, await market.price_oracle());
      await mintAndApprove(vBase, baseAmount, market.address);
      await mintAndApprove(vQuote, quoteAmount, market.address);

      await await market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );
      // remove liquidity
      await expect(
        market['remove_liquidity(uint256,uint256[2])'](0, [
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
      const baseAmount = rDiv(quoteAmount, await market.price_oracle());
      await mintAndApprove(vBase, baseAmount.mul(4), market.address);
      await mintAndApprove(vQuote, quoteAmount.mul(4), market.address);

      await market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );
      await market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );

      expect(await market.balances(0)).to.be.equal(quoteAmount.mul(2));
      expect(await market.balances(1)).to.be.equal(baseAmount.mul(2));
      expect(await vBase.balanceOf(market.address)).to.be.equal(
        baseAmount.mul(2)
      );
      expect(await vQuote.balanceOf(market.address)).to.be.equal(
        quoteAmount.mul(2)
      );
      expect(await curveToken.balanceOf(deployerAccount)).to.be.above(0); // TODO: Calculate correct amount of minted lp tokens
    });
  });
  describe('Trading', function () {
    it('Can call dy', async function () {
      await fundCurvePool(market, vBase, vQuote);
      const dx = ethers.utils.parseEther('1');

      const expectedResult = await TEST_get_dy(market, 0, 1, dx);
      const result = await market.get_dy(0, 1, dx);
      expect(result).to.be.equal(expectedResult);
    });

    it('Can exchange quote for base token', async function () {
      await fundCurvePool(market, vBase, vQuote);

      // mint tokens to trade
      const sellQuoteAmount = ethers.utils.parseEther('1');
      await mintAndApprove(vQuote, sellQuoteAmount, market.address);

      // vQuote is 0, vBase is 1
      expect(vQuote.address).to.be.equal(await market.coins(0));
      expect(vBase.address).to.be.equal(await market.coins(1));

      // check balances before trade
      const balancesVQuoteBefore = await vQuote.balanceOf(deployerAccount);
      const balanceVBaseBefore = await vBase.balanceOf(deployerAccount);

      // trade some tokens
      const eBuyBaseAmount = await market.get_dy(0, 1, sellQuoteAmount);
      await market['exchange(uint256,uint256,uint256,uint256)'](
        0,
        1,
        sellQuoteAmount,
        MIN_MINT_AMOUNT
      );

      // check balances after trade
      const balancesVQuoteAfter = await vQuote.balanceOf(deployerAccount);
      const balanceVBaseAfter = await vBase.balanceOf(deployerAccount);

      expect(balancesVQuoteAfter.add(sellQuoteAmount)).to.be.equal(
        balancesVQuoteBefore
      );
      expect(balanceVBaseAfter.sub(balanceVBaseBefore)).to.be.equal(
        eBuyBaseAmount
      );
    });

    it('Can exchange base for quote token', async function () {
      await fundCurvePool(market, vBase, vQuote);

      // mint tokens to trade
      const sellBaseAmount = ethers.utils.parseEther('1');
      await mintAndApprove(vBase, sellBaseAmount, market.address);

      // vQuote is 0, vBase is 1
      expect(vQuote.address).to.be.equal(await market.coins(0));
      expect(vBase.address).to.be.equal(await market.coins(1));

      // check balances before trade
      const balancesVQuoteBefore = await vQuote.balanceOf(deployerAccount);
      const balanceVBaseBefore = await vBase.balanceOf(deployerAccount);

      // trade some tokens
      const eBuyQuoteAmount = await market.get_dy(1, 0, sellBaseAmount);
      await market['exchange(uint256,uint256,uint256,uint256)'](
        1,
        0,
        sellBaseAmount,
        MIN_MINT_AMOUNT
      );

      // check balances after trade
      const balancesVQuoteAfter = await vQuote.balanceOf(deployerAccount);
      const balanceVBaseAfter = await vBase.balanceOf(deployerAccount);

      expect(balanceVBaseAfter.add(sellBaseAmount)).to.be.equal(
        balanceVBaseBefore
      );
      expect(balancesVQuoteAfter.sub(balancesVQuoteBefore)).to.be.equal(
        eBuyQuoteAmount
      );
    });
  });
  describe('Trading & Liquidity Provision', function () {
    it.only('Can provide liquidity after some trading', async function () {
      // init
      await fundCurvePool(market, vBase, vQuote);
      await buyVBaseAndBurn(market, vBase, vQuote);

      console.log('has finished init');

      /* provide liquidity */

      // mint tokens
      const quoteAmount = ethers.utils.parseEther('10');
      const baseAmount = rDiv(quoteAmount, await market.price_oracle());
      await mintAndApprove(vQuote, quoteAmount, market.address);
      await mintAndApprove(vBase, baseAmount, market.address);

      expect(await vQuote.balanceOf(deployerAccount)).be.equal(quoteAmount);
      expect(await vQuote.allowance(deployerAccount, market.address)).be.equal(
        quoteAmount
      );
      expect(await vBase.balanceOf(deployerAccount)).be.equal(baseAmount);
      expect(await vBase.allowance(deployerAccount, market.address)).be.equal(
        baseAmount
      );

      const balanceQuoteBefore = await market.balances(0);
      const balanceBaseBefore = await market.balances(1);

      // provide liquidity
      await market['add_liquidity(uint256[2],uint256)'](
        [quoteAmount, baseAmount],
        MIN_MINT_AMOUNT
      );

      expect(await market.balances(0)).to.be.equal(
        balanceQuoteBefore.add(quoteAmount)
      );
      expect(await market.balances(1)).to.be.equal(
        balanceBaseBefore.add(baseAmount)
      );
      expect(await vBase.balanceOf(market.address)).to.be.equal(
        balanceBaseBefore.add(baseAmount)
      );
      expect(await vQuote.balanceOf(market.address)).to.be.equal(
        balanceQuoteBefore.add(quoteAmount)
      );
      expect(await curveToken.balanceOf(deployerAccount)).to.be.above(0); // TODO: Calculate correct amount of minted lp tokens
    });
  });
});
