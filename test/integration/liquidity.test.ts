import {expect} from 'chai';
import {BigNumber} from 'ethers';
import env = require('hardhat');

// helpers
import {setup, funding, User} from '../helpers/setup';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {
  impersonateAccountsHardhat,
  fundAccountsHardhat,
  setupUser,
} from '../../helpers/misc-utils';
import {TEST_dust_remove_liquidity} from '../helpers/CurveUtils';
import {getChainlinkPrice} from '../../helpers/contracts-deployments';
import {asBigNumber, rDiv} from '../helpers/utils/calculations';
import {DEAD_ADDRESS} from '../../helpers/constants';
import {Side} from '../helpers/utils/types';

describe('Increment App: Liquidity', function () {
  let user: User, bob: User, alice: User;
  let liquidityAmount: BigNumber;

  // constants
  const MIN_MINT_AMOUNT = BigNumber.from(0);

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

    it('Should allow to deposit positive, emit event', async function () {
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
      const vBaseBefore = await user.vBase.balanceOf(user.market.address);
      const vQuoteBefore = await user.vQuote.balanceOf(user.market.address);
      const vBaselpBalance = await user.market.balances(1);
      const vQuotelpBalance = await user.market.balances(0);

      const price = await getChainlinkPrice(env, 'EUR_USD');

      const liquidityWadAmount = await tokenToWad(
        await user.vault.getReserveTokenDecimals(),
        liquidityAmount
      ); // deposited liquidity with 18 decimals

      expect(vBaseBefore).to.be.equal(vBaselpBalance);
      expect(vQuoteBefore).to.be.equal(vQuotelpBalance);

      // deposit
      await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);

      // after you deposit
      /* relative price should not change */
      expect(await user.perpetual.marketPrice()).to.be.equal(price);
      /* balances should increment */
      expect(await user.vQuote.balanceOf(user.market.address)).to.be.equal(
        vQuoteBefore.add(liquidityWadAmount)
      );
      expect(await user.vBase.balanceOf(user.market.address)).to.be.equal(
        vBaseBefore.add(rDiv(liquidityWadAmount, price))
      );
      expect(await user.market.balances(0)).to.be.equal(
        vQuotelpBalance.add(liquidityWadAmount)
      );
      expect(await user.market.balances(1)).to.be.equal(
        vBaselpBalance.add(rDiv(liquidityWadAmount, price))
      );
    });

    it('Should split subsequent deposits according to current ratio in pool', async function () {
      // bob deposits some assets
      await bob.perpetual.provideLiquidity(liquidityAmount, bob.usdc.address);

      // trade some assets to change the ratio in the pool
      const depositAmount = liquidityAmount.div(10);
      await alice.perpetual.deposit(depositAmount, alice.usdc.address);
      await alice.perpetual.openPosition(depositAmount.mul(2), Side.Long);

      // before you deposit more liquidity
      const vBaseBefore = await user.vBase.balanceOf(user.market.address);
      const vQuoteBefore = await user.vQuote.balanceOf(user.market.address);
      const vBaselpBalance = await user.market.balances(1);
      const vQuotelpBalance = await user.market.balances(0);
      expect(vBaseBefore).to.be.equal(vBaselpBalance);
      expect(vQuoteBefore).to.be.equal(vQuotelpBalance);

      const priceBefore = rDiv(vQuoteBefore, vBaseBefore);
      const liquidityWadAmount = await tokenToWad(
        await user.vault.getReserveTokenDecimals(),
        liquidityAmount
      ); // deposited liquidity with 18 decimals

      // deposit more liquidity
      await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);

      // after you deposit

      /* balances should increment */
      expect(await user.vQuote.balanceOf(user.market.address)).to.be.equal(
        vQuoteBefore.add(liquidityWadAmount)
      );
      expect(await user.vBase.balanceOf(user.market.address)).to.be.equal(
        vBaseBefore.add(rDiv(liquidityWadAmount, priceBefore))
      );
      expect(await user.market.balances(1)).to.be.equal(
        vBaselpBalance.add(rDiv(liquidityWadAmount, priceBefore))
      );
      expect(await user.market.balances(0)).to.be.equal(
        vQuotelpBalance.add(liquidityWadAmount)
      );
    });

    describe('Can withdraw liquidity from the curve pool', async function () {
      it('Should not allow to withdraw liquidity when non provided', async function () {
        await expect(
          user.perpetual.removeLiquidity(asBigNumber('1'))
        ).to.be.revertedWith('Not enough liquidity provided');
      });

      it('Should allow not to withdraw more liquidity than provided', async function () {
        // deposit
        await user.perpetual.provideLiquidity(
          liquidityAmount,
          user.usdc.address
        );

        // try withdraw
        const providedLiquidity = (
          await user.perpetual.getLpPosition(user.address)
        ).liquidityBalance;

        await expect(
          user.perpetual.removeLiquidity(
            providedLiquidity.add(BigNumber.from('1'))
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
        const marketAccount = await setupUser(user.market.address, {
          vBase: user.vBase,
        });
        await fundAccountsHardhat([user.market.address], env);

        /* withdraw liquidity from curve pool*/
        await marketAccount.vBase.transfer(
          DEAD_ADDRESS,
          await user.vBase.balanceOf(user.market.address)
        );
        expect(await user.vBase.balanceOf(user.market.address)).to.be.equal(0);

        // try withdrawal from pool:
        await expect(
          user.perpetual.removeLiquidity(liquidityAmount)
        ).to.be.revertedWith('');
      });

      it('Should allow to remove liquidity from pool, emit event', async function () {
        // deposit
        await user.perpetual.provideLiquidity(
          liquidityAmount,
          user.usdc.address
        );

        // add extra liquidity else, the amounts of lp.openNotional and lp.positionSize are too small (respectively -2
        // and -1) for market.exchange to work when closing the PnL of the position
        await bob.perpetual.provideLiquidity(
          liquidityAmount,
          user.usdc.address
        );

        // withdraw
        const providedLiquidity = (
          await user.perpetual.getLpPosition(user.address)
        ).liquidityBalance;

        const perpetualVQuoteAmountBeforeWithdraw = await user.vQuote.balanceOf(
          user.perpetual.address
        );

        await expect(user.perpetual.removeLiquidity(providedLiquidity))
          .to.emit(user.perpetual, 'LiquidityRemoved')
          .withArgs(user.address, providedLiquidity);

        const perpetualVQuoteAmountAfterWithdraw = await user.vQuote.balanceOf(
          user.perpetual.address
        );

        expect(perpetualVQuoteAmountBeforeWithdraw).to.eq(
          perpetualVQuoteAmountAfterWithdraw
        );
      });

      it('Should remove correct amount of liquidity from pool', async function () {
        // deposit
        await user.perpetual.provideLiquidity(
          liquidityAmount,
          user.usdc.address
        );
        const userBalanceAfter = await user.usdc.balanceOf(user.address);
        expect(userBalanceAfter).to.be.equal(0);

        // withdraw
        const positionBefore = await user.perpetual.getLpPosition(user.address);

        const dust = await TEST_dust_remove_liquidity(
          // dust balances remaining in contract
          user.market,
          positionBefore.liquidityBalance,
          [MIN_MINT_AMOUNT, MIN_MINT_AMOUNT]
        );

        await expect(
          user.perpetual.removeLiquidity(positionBefore.liquidityBalance)
        )
          .to.emit(user.perpetual, 'LiquidityRemoved')
          .withArgs(user.address, positionBefore.liquidityBalance);

        const positionAfter = await user.perpetual.getLpPosition(user.address);

        expect(positionAfter.liquidityBalance).to.be.equal(0);
        expect(positionAfter.cumFundingRate).to.be.equal(0);
        expect(positionAfter.positionSize).to.be.equal(-dust.base);
        expect(positionAfter.openNotional).to.be.equal(-dust.quote);
      });

      it('Should remove and withdraw liquidity from pool, then delete LP position', async function () {
        // deposit
        await user.perpetual.provideLiquidity(
          liquidityAmount,
          user.usdc.address
        );

        // add extra liquidity else, the amounts of lp.openNotional and lp.positionSize are too small (respectively -2
        // and -1) for market.exchange to work when closing the PnL of the position
        await bob.perpetual.provideLiquidity(
          liquidityAmount,
          user.usdc.address
        );

        // withdraw
        const providedLiquidity = (
          await user.perpetual.getLpPosition(user.address)
        ).liquidityBalance;

        await expect(user.perpetual.removeLiquidity(providedLiquidity))
          .to.emit(user.perpetual, 'LiquidityRemoved')
          .withArgs(user.address, providedLiquidity);

        await user.perpetual.settleAndWithdrawLiquidity(0);

        const positionAfter = await user.perpetual.getLpPosition(user.address);

        // everything should be set to 0
        expect(positionAfter.liquidityBalance).to.be.equal(0);
        expect(positionAfter.cumFundingRate).to.be.equal(0);
        expect(positionAfter.positionSize).to.be.equal(0);
        expect(positionAfter.openNotional).to.be.equal(0);
      });
    });

    describe('Misc', async function () {
      it('Should emit provide liquidity event in the curve pool', async function () {
        const price = await user.perpetual.indexPrice(); // valid for first deposit
        const liquidityWadAmount = await tokenToWad(
          await user.vault.getReserveTokenDecimals(),
          liquidityAmount
        ); // deposited liquidity with 18 decimals

        const PRECISION = asBigNumber('1');
        await expect(
          user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address)
        )
          .to.emit(user.market, 'AddLiquidity')
          .withArgs(
            user.perpetual.address,
            [liquidityWadAmount, liquidityWadAmount.mul(PRECISION).div(price)],
            0,
            0
          );
      });

      // TODO: wait for open/close position logic to be implemented
      // TODO: it('Should not allow to use the deposited liquidity to open up a long position', async function () {
      // TODO: it('Can calculate profit from liquidity provision', async function () {});
      // TODO: it('Should not allow to use the deposited liquidity to open up a long position', async function () {
      //   // deposit
    });
  });
});
