// typechain objects
import {CryptoSwap} from '../../contracts-vyper/typechain/CryptoSwap';
import {CurveTokenV5} from '../../contracts-vyper/typechain/CurveTokenV5';
import {CryptoSwap__factory} from '../../contracts-vyper/typechain/factories/CryptoSwap__factory';
import {CurveTokenV5__factory} from '../../contracts-vyper/typechain/factories/CurveTokenV5__factory';
import {VBase, VQuote} from '../../typechain';
import {VBase__factory, VQuote__factory} from '../../typechain';

// utils
import {Signer} from 'ethers';
import {ethers} from 'hardhat';
import env from 'hardhat';

import {getCryptoSwapConstructorArgs} from '../../helpers/contracts-deployments';
import {fundAccountsHardhat} from '../../helpers/misc-utils';
import {tEthereumAddress, BigNumber} from '../../helpers/types';

import chaiModule = require('../chai-setup');
const {expect} = chaiModule;

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
      curveToken.address,
      vBase.address,
      vQuote.address
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
    expect(await market.coins(0)).to.be.equal(vBase.address);
    expect(await market.coins(1)).to.be.equal(vQuote.address);
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
  });

  it('Should provide liquidity', async function () {
    // mint tokens
    const mintAmount = ethers.utils.parseEther('10');
    await vBase.mint(mintAmount);
    await vQuote.mint(mintAmount);
    await vBase.approve(market.address, mintAmount);
    await vQuote.approve(market.address, mintAmount);
    expect(await vBase.balanceOf(deployerAccount)).be.equal(mintAmount);
    expect(await vQuote.balanceOf(deployerAccount)).be.equal(mintAmount);
    expect(await vBase.allowance(deployerAccount, market.address)).be.equal(
      mintAmount
    );
    expect(await vQuote.allowance(deployerAccount, market.address)).be.equal(
      mintAmount
    );

    // pre-check assert statement

    // assert not self.is_killed  # dev: the pool is killed
    expect(await market.is_killed()).to.be.false;
    expect(await market.is_killed()).to.be.false;

    //github.com/ethers-io/ethers.js/issues/368
    await cryptoswap.add_liquidity(
      [mintAmount.div(2), mintAmount.div(2)],
      ethers.BigNumber.from(0)
    );
  });
});
