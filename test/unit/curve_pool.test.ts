// typechain objects
import {CryptoSwap} from '../../contracts-vyper/typechain/CryptoSwap';
import {CurveTokenV5} from '../../contracts-vyper/typechain/CurveTokenV5';
import {CryptoSwap__factory} from '../../contracts-vyper/typechain/factories/CryptoSwap__factory';
import {CurveTokenV5__factory} from '../../contracts-vyper/typechain/factories/CurveTokenV5__factory';
import {IERC20, VBase, VQuote, VirtualToken} from '../../typechain';
import {VBase__factory, VQuote__factory} from '../../typechain';

// utils
import {Signer} from 'ethers';
import {ethers} from 'hardhat';
import env from 'hardhat';
import {rDiv, rMul} from '../integration/helpers/utils/calculations';

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

describe('Cryptoswap: Unit tests', function () {
  // contract and accounts
  let deployer: Signer;
  let deployerAccount: tEthereumAddress;
  let cryptoswap: CryptoSwap, market: CryptoSwap;
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

    cryptoswap = await FundingFactory.deploy(
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
    market = cryptoswap.connect(deployer);

    // set curve as minter
    await curveToken.connect(deployer).set_minter(cryptoswap.address);
  });

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
      cryptoswap.add_liquidity([quoteAmount, baseAmount], MIN_MINT_AMOUNT)
    )
      .to.emit(cryptoswap, 'AddLiquidity')
      .withArgs(deployerAccount, [quoteAmount, baseAmount], 0, 0);

    expect(await market.balances(0)).to.be.equal(quoteAmount);
    expect(await market.balances(1)).to.be.equal(baseAmount);
    expect(await vBase.balanceOf(cryptoswap.address)).to.be.equal(baseAmount);
    expect(await vQuote.balanceOf(cryptoswap.address)).to.be.equal(quoteAmount);
    expect(await curveToken.balanceOf(deployerAccount)).to.be.above(0); // TODO: Calculate correct amount of minted lp tokens
  });
  it('Can not provide zero liquidity', async function () {
    // provide liquidity
    await expect(cryptoswap.add_liquidity([0, 0], 0)).to.be.revertedWith('');
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

    await cryptoswap.add_liquidity([quoteAmount, baseAmount], MIN_MINT_AMOUNT);

    const lpTokenBalance = await curveToken.balanceOf(deployerAccount);
    expect(lpTokenBalance).to.be.above(0);

    // TODO: Why do we get this (leftover) balance?
    const remainingBalances = [
      ethers.BigNumber.from('9999999999999999998'), // 9.9999 with 18 decimals
      ethers.BigNumber.from('8333333333333333332'),
    ];
    await expect(cryptoswap.remove_liquidity(lpTokenBalance, [0, 0]))
      .to.emit(cryptoswap, 'RemoveLiquidity')
      .withArgs(deployerAccount, remainingBalances, 0);
  });
  it('Can not withdraw 0 liquidity', async function () {
    // mint tokens
    const quoteAmount = ethers.utils.parseEther('10');
    const baseAmount = rDiv(quoteAmount, await market.price_oracle());
    await mintAndApprove(vBase, baseAmount, market.address);
    await mintAndApprove(vQuote, quoteAmount, market.address);

    await await cryptoswap.add_liquidity(
      [quoteAmount, baseAmount],
      MIN_MINT_AMOUNT
    );
    // remove liquidity
    await expect(
      cryptoswap.remove_liquidity(0, [MIN_MINT_AMOUNT, MIN_MINT_AMOUNT])
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

    await cryptoswap.add_liquidity([quoteAmount, baseAmount], MIN_MINT_AMOUNT);
    await cryptoswap.add_liquidity([quoteAmount, baseAmount], MIN_MINT_AMOUNT);

    expect(await market.balances(0)).to.be.equal(quoteAmount.mul(2));
    expect(await market.balances(1)).to.be.equal(baseAmount.mul(2));
    expect(await vBase.balanceOf(cryptoswap.address)).to.be.equal(
      baseAmount.mul(2)
    );
    expect(await vQuote.balanceOf(cryptoswap.address)).to.be.equal(
      quoteAmount.mul(2)
    );
    expect(await curveToken.balanceOf(deployerAccount)).to.be.above(0); // TODO: Calculate correct amount of minted lp tokens
  });
});
