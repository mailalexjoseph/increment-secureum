import chaiModule = require('../chai-setup');
const {expect} = chaiModule;

import {setup, funding, User} from './helpers/setup';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';

describe('Increment App: Liquidity', function () {
  let user: User, bob: User;
  let liquidityAmount: BigNumber;

  const PRECISON = ethers.utils.parseEther('1');

  beforeEach('Set up', async () => {
    ({user, bob} = await setup());
    liquidityAmount = await funding();
    await user.usdc.approve(user.vault.address, liquidityAmount);
    await bob.usdc.approve(bob.vault.address, liquidityAmount);
  });

  describe('Can deposit and withdraw liquidity to the curve pool', function () {
    it('Should not allow to deposit zero', async function () {
      await expect(
        user.perpetual.provideLiquidity(0, user.usdc.address)
      ).to.be.revertedWith('Zero amount');
    });
    it('Should allow to deposit positive', async function () {
      await expect(
        user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address)
      )
        .to.emit(user.perpetual, 'LiquidityProvided')
        .withArgs(user.address, user.usdc.address, liquidityAmount);

      // should have correct balance in vault
      expect(await user.usdc.balanceOf(user.address)).to.be.equal(0);
      expect(await user.usdc.balanceOf(user.vault.address)).to.be.equal(
        liquidityAmount
      );
    });
    it('Should not allow to deposit twice', async function () {
      await user.perpetual.provideLiquidity(
        liquidityAmount.div(2),
        user.usdc.address
      );
      await expect(
        user.perpetual.provideLiquidity(
          liquidityAmount.div(2),
          user.usdc.address
        )
      ).to.be.revertedWith('Has provided liquidity before');
    });

    it('Should split first deposit according to current chainlink price', async function () {
      // before you deposit
      const vEURBefore = await user.vEUR.balanceOf(user.market.address);
      const vUSDBefore = await user.vUSD.balanceOf(user.market.address);
      const vEURlpBalance = await user.market.balances(0);
      const vUSDlpBalance = await user.market.balances(1);
      const price = await user.oracle.getAssetPrice(user.perpetual.address);
      const liquidityWadAmount = await tokenToWad(user.usdc, liquidityAmount); // deposited liquidity with 18 decimals
      expect(vEURBefore).to.be.equal(vEURlpBalance);
      expect(vUSDBefore).to.be.equal(vUSDlpBalance);

      // deposit
      await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);

      // after you deposit
      /* relative price should not change */
      expect(await user.perpetual.marketPrice()).to.be.equal(price);
      /* balances should increment */
      expect(await user.vUSD.balanceOf(user.market.address)).to.be.equal(
        vUSDBefore.add(liquidityWadAmount.div(2))
      );
      expect(await user.vEUR.balanceOf(user.market.address)).to.be.equal(
        vEURBefore.add(liquidityWadAmount.div(2).mul(PRECISON).div(price))
      );
      expect(await user.market.balances(0)).to.be.equal(
        vEURlpBalance.add(liquidityWadAmount.div(2).mul(PRECISON).div(price))
      );
      expect(await user.market.balances(1)).to.be.equal(
        vUSDlpBalance.add(liquidityWadAmount.div(2))
      );
    });

    it('Should split subsequent deposits according to current ratio in pool', async function () {
      // bob deposits some assets
      await bob.perpetual.provideLiquidity(liquidityAmount, bob.usdc.address);

      // before you deposit
      const vEURBefore = await user.vEUR.balanceOf(user.market.address);
      const vUSDBefore = await user.vUSD.balanceOf(user.market.address);
      const vEURlpBalance = await user.market.balances(0);
      const vUSDlpBalance = await user.market.balances(1);
      const price = await user.perpetual.marketPrice();
      const liquidityWadAmount = await tokenToWad(user.usdc, liquidityAmount); // deposited liquidity with 18 decimals
      expect(vEURBefore).to.be.equal(vEURlpBalance);
      expect(vUSDBefore).to.be.equal(vUSDlpBalance);

      // deposit
      await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);

      // after you deposit
      /* relative price should not change */
      expect(await user.perpetual.marketPrice()).to.be.equal(price);
      /* balances should increment */
      expect(await user.vUSD.balanceOf(user.market.address)).to.be.equal(
        vUSDBefore.add(liquidityWadAmount.div(2))
      );
      expect(await user.vEUR.balanceOf(user.market.address)).to.be.equal(
        vEURBefore.add(liquidityWadAmount.div(2).mul(PRECISON).div(price))
      );
      expect(await user.market.balances(0)).to.be.equal(
        vEURlpBalance.add(liquidityWadAmount.div(2).mul(PRECISON).div(price))
      );
      expect(await user.market.balances(1)).to.be.equal(
        vUSDlpBalance.add(liquidityWadAmount.div(2))
      );
    });
    // TODO: wait for open/close position logic to be implemented
    // it('Should not allow to use the deposited liquidity to open up a long position', async function () {
    //   // deposit
    //   await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);

    //   // try to open a position
    //   await expect(user.perpetual.openPosition(10,0)).to.be.revertedWith("")
    // });

    it('Should not allow to withdraw liquidity when non provided', async function () {
      await expect(
        user.perpetual.withdrawLiquidity(liquidityAmount, user.usdc.address)
      ).to.be.revertedWith('Not enough liquidity provided');
    });

    it('Should not allow to withdraw liquidity more liquidity then provided', async function () {
      // deposit
      await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);

      // withdraw
      await expect(
        user.perpetual.withdrawLiquidity(
          liquidityAmount.add(BigNumber.from('1')),
          user.usdc.address
        )
      ).to.be.revertedWith('Not enough liquidity provided');
    });

    it('Should allow to withdraw liquidity', async function () {
      // deposit
      await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);

      // withdraw
      await expect(
        user.perpetual.withdrawLiquidity(liquidityAmount, user.usdc.address)
      )
        .to.emit(user.perpetual, 'LiquidityWithdrawn')
        .withArgs(user.address, user.usdc.address, liquidityAmount);
    });
  });
});
