import chaiModule = require('../chai-setup');
const {expect} = chaiModule;

import {setup, funding, User} from './helpers/setup';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';
import {
  impersonateAccountsHardhat,
  fundAccountsHardhat,
} from '../../helpers/misc-utils';
import {getChainlinkPrice} from '../../helpers/contracts-deployments';
import {rDiv} from './helpers/utils/calculations';
import {DEAD_ADDRESS} from '../../helpers/constants';
import {Side} from './helpers/utils/types';

const {getSigner} = ethers;

import env = require('hardhat');
import {Perpetual} from '../../typechain';

const logPrice = async (perp: Perpetual) => {
  console.log(
    'marketPrice is',
    ethers.utils.formatEther(await perp.marketPrice())
  );
};

describe('Increment App: Liquidity', function () {
  let user: User, bob: User, alice: User;
  let liquidityAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({user, bob, alice} = await setup());
    liquidityAmount = await funding();
    await user.usdc.approve(user.vault.address, liquidityAmount);
    await bob.usdc.approve(bob.vault.address, liquidityAmount);
    await alice.usdc.approve(alice.vault.address, liquidityAmount);
  });

  describe('Can deposit liquidity to the curve pool', async function () {
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
      const vEURlpBalance = await user.market.balances(1);
      const vUSDlpBalance = await user.market.balances(0);
      const price = await getChainlinkPrice(env, 'EUR_USD');
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
        vEURBefore.add(rDiv(liquidityWadAmount.div(2), price))
      );
      expect(await user.market.balances(0)).to.be.equal(
        vUSDlpBalance.add(liquidityWadAmount.div(2))
      );
      expect(await user.market.balances(1)).to.be.equal(
        vEURlpBalance.add(rDiv(liquidityWadAmount.div(2), price))
      );
    });

    it.skip('Should split subsequent deposits according to current ratio in pool', async function () {
      // bob deposits some assets
      await bob.perpetual.provideLiquidity(liquidityAmount, bob.usdc.address);

      console.log(
        'vEURBefore',
        (await user.vEUR.balanceOf(user.market.address)).toString()
      );
      console.log(
        'vUSDBefore',
        (await user.vUSD.balanceOf(user.market.address)).toString()
      );
      console.log(
        ethers.utils.formatEther(await bob.market.get_virtual_price())
      );
      console.log(ethers.utils.formatEther(await bob.market.price_oracle()));
      console.log(ethers.utils.formatEther(await bob.market.lp_price()));
      console.log(ethers.utils.formatEther(await bob.market.get_dy(0, 1, 1)));

      // trade some assets to change the ratio in the pool

      const depositAmount = liquidityAmount.div(10);
      await alice.perpetual.deposit(depositAmount, alice.usdc.address);
      await alice.perpetual.openPosition(depositAmount.mul(2), Side.Long);

      // before you deposit
      const vEURBefore = await user.vEUR.balanceOf(user.market.address);
      const vUSDBefore = await user.vUSD.balanceOf(user.market.address);
      const vEURlpBalance = await user.market.balances(1);
      const vUSDlpBalance = await user.market.balances(0);
      expect(vEURBefore).to.be.equal(vEURlpBalance);
      expect(vUSDBefore).to.be.equal(vUSDlpBalance);

      const priceBefore = rDiv(vUSDBefore, vEURBefore);
      const price = await user.perpetual.marketPrice();
      const liquidityWadAmount = await tokenToWad(user.usdc, liquidityAmount); // deposited liquidity with 18 decimals

      console.log(
        'vEURBefore',
        (await user.vEUR.balanceOf(user.market.address)).toString()
      );
      console.log(
        'vUSDBefore',
        (await user.vUSD.balanceOf(user.market.address)).toString()
      );
      console.log(
        ethers.utils.formatEther(await bob.market.get_virtual_price())
      );
      console.log(ethers.utils.formatEther(await bob.market.price_oracle()));
      console.log(ethers.utils.formatEther(await bob.market.lp_price()));
      console.log(ethers.utils.formatEther(await bob.market.get_dy(0, 1, 1)));

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
        vEURBefore.add(rDiv(liquidityWadAmount.div(2), price))
      );
      expect(await user.market.balances(1)).to.be.equal(
        vEURlpBalance.add(rDiv(liquidityWadAmount.div(2), price))
      );
      expect(await user.market.balances(0)).to.be.equal(
        vUSDlpBalance.add(liquidityWadAmount.div(2))
      );
    });

    // TODO: wait for open/close position logic to be implemented
    // it('Should not allow to use the deposited liquidity to open up a long position', async function () {
    //   // deposit
    //   await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);
    describe('Can withdraw liquidity from the curve pool', async function () {
      it('Should not allow to withdraw liquidity when non provided', async function () {
        await expect(
          user.perpetual.withdrawLiquidity(liquidityAmount, user.usdc.address)
        ).to.be.revertedWith('Not enough liquidity provided');
      });

      it('Should not allow to withdraw liquidity more liquidity then provided', async function () {
        // deposit
        await user.perpetual.provideLiquidity(
          liquidityAmount,
          user.usdc.address
        );

        // withdraw
        await expect(
          user.perpetual.withdrawLiquidity(
            liquidityAmount.add(BigNumber.from('1')),
            user.usdc.address
          )
        ).to.be.revertedWith('Not enough liquidity provided');
      });

      it('Should revert withdrawal if not enough liquidity in the pool', async function () {
        // deposit
        await user.perpetual.provideLiquidity(
          liquidityAmount,
          user.usdc.address
        );

        // withdraw token liquidity from pool

        /* take over curve pool & fund with ether*/
        await impersonateAccountsHardhat([user.market.address], env);
        const marketSigner = await getSigner(user.market.address);
        await fundAccountsHardhat([user.market.address], env);

        /* withdraw liquidity from curve pool*/
        const vEUR = await ethers.getContract('VBase', user.address);
        await vEUR
          .connect(marketSigner)
          .transfer(
            DEAD_ADDRESS,
            await user.vEUR.balanceOf(user.market.address)
          );
        expect(await user.vEUR.balanceOf(user.market.address)).to.be.equal(0);

        // try withdrawal from pool:
        await expect(
          user.perpetual.withdrawLiquidity(liquidityAmount, user.usdc.address)
        ).to.be.revertedWith('');
      });

      it.skip('Should allow to withdraw liquidity', async function () {
        // deposit
        await user.perpetual.provideLiquidity(
          liquidityAmount,
          user.usdc.address
        );

        // withdraw
        // try withdrawal from pool
        await user.perpetual.withdrawLiquidity(
          liquidityAmount,
          user.usdc.address
        );
      });
      it.skip('Should allow to withdraw liquidity', async function () {
        const userBalanceStart = await user.usdc.balanceOf(user.address);

        // deposit
        await user.perpetual.provideLiquidity(
          liquidityAmount,
          user.usdc.address
        );
        const userBalanceAfter = await user.usdc.balanceOf(user.address);

        //withdraw;
        await expect(
          user.perpetual.withdrawLiquidity(liquidityAmount, user.usdc.address)
        )
          .to.emit(user.perpetual, 'LiquidityWithdrawn')
          .withArgs(user.address, user.usdc.address, liquidityAmount);
        const userBalanceEnd = await user.usdc.balanceOf(user.address);

        // check balances
        expect(userBalanceEnd).to.be.equal(userBalanceStart);
        expect(userBalanceAfter).to.be.equal(0);
      });
      describe('Can calculate profit from liquidity provision', async function () {});
    });
    describe('Misc', async function () {
      it.skip('Should emit provide liquidity event in the curve pool', async function () {
        const price = await user.perpetual.marketPrice();
        const liquidityWadAmount = await tokenToWad(user.usdc, liquidityAmount); // deposited liquidity with 18 decimals

        const PRECISON = ethers.utils.parseEther('1');
        console.log(
          'has already provided',
          await user.perpetual.totalLiquidityProvided()
        );
        await expect(
          user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address)
        )
          .to.emit(user.market.address, 'LiquidityProvided')
          .withArgs(
            user.perpetual.address,
            [
              liquidityWadAmount.div(2).mul(PRECISON).div(price),
              liquidityWadAmount.div(2),
            ],
            0,
            0
          );
      });

      // TODO: wait for open/close position logic to be implemented
      it.skip('Should not allow to use the deposited liquidity to open up a long position', async function () {
        //   // deposit
        //   await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);
        //   // try to open a position
        //   await expect(user.perpetual.openPosition(10,0)).to.be.revertedWith("")
      });
    });
  });
});
