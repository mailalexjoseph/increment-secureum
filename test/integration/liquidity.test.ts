import {expect} from 'chai';
import {BigNumber} from 'ethers';
import env, {ethers} from 'hardhat';

// helpers
import {setup, funding, User} from '../helpers/setup';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {
  impersonateAccountsHardhat,
  fundAccountsHardhat,
  setupUser,
} from '../../helpers/misc-utils';
import {TEST_dust_remove_liquidity} from '../helpers/CurveUtils';
import {getChainlinkPrice} from '../../helpers/contracts-getters';
import {asBigNumber, rDiv} from '../helpers/utils/calculations';
import {DEAD_ADDRESS} from '../../helpers/constants';
import {Side} from '../helpers/utils/types';

import {
  extendPositionWithCollateral,
  provideLiquidity,
  deriveProposedAmount,
  liquidityProviderProposedAmount,
} from '../helpers/PerpetualUtils';

describe.only('Increment App: Liquidity', function () {
  let lp: User, lpTwo: User, trader: User;
  let liquidityAmountUSDC: BigNumber;

  // constants
  const MIN_MINT_AMOUNT = BigNumber.from(0);

  beforeEach('Set up', async () => {
    ({lp, trader, lpTwo} = await setup());
    liquidityAmountUSDC = await funding();
    await lp.usdc.approve(lp.vault.address, liquidityAmountUSDC);
    await lpTwo.usdc.approve(lpTwo.vault.address, liquidityAmountUSDC);
    await trader.usdc.approve(trader.vault.address, liquidityAmountUSDC);
  });

  describe('Can deposit liquidity to the curve pool', async function () {
    it('Should not allow to deposit zero', async function () {
      await expect(
        lp.clearingHouse.provideLiquidity(0, 0, lp.usdc.address)
      ).to.be.revertedWith('Zero amount');
    });

    it('Should allow to deposit positive, emit event', async function () {
      await expect(
        lp.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC,
          lp.usdc.address
        )
      )
        .to.emit(lp.clearingHouse, 'LiquidityProvided')
        .withArgs(0, lp.address, lp.usdc.address, liquidityAmountUSDC);

      // should have correct balance in vault
      expect(await lp.usdc.balanceOf(lp.address)).to.be.equal(0);
      expect(await lp.usdc.balanceOf(lp.vault.address)).to.be.equal(
        liquidityAmountUSDC
      );
    });

    it('Should not allow to deposit twice', async function () {
      await lp.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC.div(2),
        lp.usdc.address
      );
      await expect(
        lp.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC.div(2),
          lp.usdc.address
        )
      ).to.be.revertedWith('Has provided liquidity before');
    });

    it('Should split first deposit according to current chainlink price', async function () {
      // before you deposit
      const vBaseBefore = await lp.vBase.balanceOf(lp.market.address);
      const vQuoteBefore = await lp.vQuote.balanceOf(lp.market.address);
      const vBaselpBalance = await lp.market.balances(1);
      const vQuotelpBalance = await lp.market.balances(0);

      const price = await getChainlinkPrice(env, 'EUR_USD');

      const liquidityWadAmount = await tokenToWad(
        await lp.vault.getReserveTokenDecimals(),
        liquidityAmountUSDC
      ); // deposited liquidity with 18 decimals

      expect(vBaseBefore).to.be.equal(vBaselpBalance);
      expect(vQuoteBefore).to.be.equal(vQuotelpBalance);

      // deposit
      await lpTwo.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC,
        lpTwo.usdc.address
      );

      // after you deposit
      /* relative price should not change */
      expect(await lpTwo.perpetual.marketPrice()).to.be.equal(price);
      /* balances should increment */
      expect(await lpTwo.vQuote.balanceOf(lpTwo.market.address)).to.be.equal(
        vQuoteBefore.add(liquidityWadAmount)
      );
      expect(await lpTwo.vBase.balanceOf(lpTwo.market.address)).to.be.equal(
        vBaseBefore.add(rDiv(liquidityWadAmount, price))
      );
      expect(await lpTwo.market.balances(0)).to.be.equal(
        vQuotelpBalance.add(liquidityWadAmount)
      );
      expect(await lpTwo.market.balances(1)).to.be.equal(
        vBaselpBalance.add(rDiv(liquidityWadAmount, price))
      );
    });

    it('Should split subsequent deposits according to current ratio in pool', async function () {
      // lp deposits some assets
      await lp.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC,
        lp.usdc.address
      );

      // trade some assets to change the ratio in the pool
      const depositAmount = liquidityAmountUSDC.div(10);
      await trader.clearingHouse.deposit(0, depositAmount, trader.usdc.address);
      await trader.clearingHouse.extendPosition(
        0,
        depositAmount.mul(2),
        Side.Long,
        0
      );

      // before you deposit more liquidity
      const vBaseBefore = await lp.vBase.balanceOf(lp.market.address);
      const vQuoteBefore = await lp.vQuote.balanceOf(lp.market.address);
      const vBaselpBalance = await lp.market.balances(1);
      const vQuotelpBalance = await lp.market.balances(0);
      expect(vBaseBefore).to.be.equal(vBaselpBalance);
      expect(vQuoteBefore).to.be.equal(vQuotelpBalance);

      const priceBefore = rDiv(vQuoteBefore, vBaseBefore);
      const liquidityWadAmount = await tokenToWad(
        await lp.vault.getReserveTokenDecimals(),
        liquidityAmountUSDC
      ); // deposited liquidity with 18 decimals

      // deposit more liquidity
      await lpTwo.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC,
        lpTwo.usdc.address
      );

      // after you deposit

      /* balances should increment */
      expect(await lpTwo.vQuote.balanceOf(lpTwo.market.address)).to.be.equal(
        vQuoteBefore.add(liquidityWadAmount)
      );
      expect(await lpTwo.vBase.balanceOf(lpTwo.market.address)).to.be.equal(
        vBaseBefore.add(rDiv(liquidityWadAmount, priceBefore))
      );
      expect(await lpTwo.market.balances(1)).to.be.equal(
        vBaselpBalance.add(rDiv(liquidityWadAmount, priceBefore))
      );
      expect(await lpTwo.market.balances(0)).to.be.equal(
        vQuotelpBalance.add(liquidityWadAmount)
      );
    });

    describe('Can withdraw liquidity from the curve pool', async function () {
      it('Should not allow to withdraw liquidity when non provided', async function () {
        await expect(
          lp.clearingHouse.removeLiquidity(
            0,
            asBigNumber('1'),
            0,
            0,
            lp.usdc.address
          )
        ).to.be.revertedWith('Cannot remove more liquidity than LP provided');
      });

      it('Should allow not to withdraw more liquidity than provided', async function () {
        // deposit
        await lp.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC,
          lp.usdc.address
        );

        // try withdraw
        const providedLiquidity = (await lp.perpetual.getLpPosition(lp.address))
          .liquidityBalance;

        await expect(
          lp.clearingHouse.removeLiquidity(
            0,
            providedLiquidity.add(BigNumber.from('1')),
            0,
            0,
            lp.usdc.address
          )
        ).to.be.revertedWith('Cannot remove more liquidity than LP provided');
      });

      it('Should revert withdrawal if not enough liquidity in the pool', async function () {
        // deposit
        await lp.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC,
          lp.usdc.address
        );

        // withdraw token liquidity from pool

        /* take over curve pool & fund with ether*/
        await impersonateAccountsHardhat([lp.market.address], env);
        const marketAccount = await setupUser(lp.market.address, {
          vBase: lp.vBase,
        });
        await fundAccountsHardhat([lp.market.address], env);

        /* withdraw liquidity from curve pool*/
        await marketAccount.vBase.transfer(
          DEAD_ADDRESS,
          await lp.vBase.balanceOf(lp.market.address)
        );
        expect(await lp.vBase.balanceOf(lp.market.address)).to.be.equal(0);

        // try withdrawal from pool:
        await expect(
          lp.clearingHouse.removeLiquidity(
            0,
            liquidityAmountUSDC,
            0,
            0,
            lp.usdc.address
          )
        ).to.be.revertedWith('');
      });

      it('Should allow to remove liquidity from pool, emit event', async function () {
        // deposit
        await lp.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC,
          lp.usdc.address
        );

        // add extra liquidity else, the amounts of lp.openNotional and lp.positionSize are too small (respectively -2
        // and -1) for market.exchange to work when closing the PnL of the position
        await lpTwo.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC,
          lpTwo.usdc.address
        );

        // withdraw
        const lpBalance = await lpTwo.perpetual.getLpPosition(lpTwo.address);

        const perpetualVQuoteAmountBeforeWithdraw =
          await lpTwo.vQuote.balanceOf(lpTwo.perpetual.address);

        const proposedAmount = await liquidityProviderProposedAmount(
          lpBalance,
          lpBalance.liquidityBalance,
          lp.market
        );
        await lpTwo.clearingHouse.removeLiquidity(
          0,
          lpBalance.liquidityBalance,
          proposedAmount,
          0,
          lp.usdc.address
        );

        const perpetualVQuoteAmountAfterWithdraw = await lpTwo.vQuote.balanceOf(
          lpTwo.perpetual.address
        );

        expect(perpetualVQuoteAmountBeforeWithdraw).to.eq(
          perpetualVQuoteAmountAfterWithdraw
        );
      });

      // Unrealistic because pool/market should never be empty
      it.skip('Should remove correct amount of liquidity from pool', async function () {
        // deposit
        await lp.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC,
          lp.usdc.address
        );
        const lpBalanceAfter = await lp.usdc.balanceOf(lp.address);
        expect(lpBalanceAfter).to.be.equal(0);

        // withdraw
        const positionBefore = await lp.perpetual.getLpPosition(lp.address);

        const dust = await TEST_dust_remove_liquidity(
          // dust balances remaining in contract
          lp.market,
          positionBefore.liquidityBalance,
          [MIN_MINT_AMOUNT, MIN_MINT_AMOUNT]
        );

        await expect(
          lp.clearingHouse.removeLiquidity(
            0,
            positionBefore.liquidityBalance,
            0,
            0,
            lp.usdc.address
          )
        )
          .to.emit(lp.clearingHouse, 'LiquidityRemoved')
          .withArgs(0, lp.address, positionBefore.liquidityBalance);

        const positionAfter = await lp.perpetual.getLpPosition(lp.address);

        expect(positionAfter.liquidityBalance).to.be.equal(0);
        expect(positionAfter.cumFundingRate).to.be.equal(0);
        expect(positionAfter.positionSize).to.be.equal(-dust.base);
        expect(positionAfter.openNotional).to.be.equal(-dust.quote);
      });

      it.skip('Should remove and withdraw liquidity from pool, then delete LP position', async function () {
        // deposit
        await lp.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC,
          lp.usdc.address
        );

        // add extra liquidity else, the amounts of lp.openNotional and lp.positionSize are too small (respectively -2
        // and -1) for market.exchange to work when closing the PnL of the position
        await lpTwo.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC,
          lpTwo.usdc.address
        );

        // withdraw
        const providedLiquidity = (
          await lpTwo.perpetual.getLpPosition(lpTwo.address)
        ).liquidityBalance;

        const tentativeQuoteAmount = await deriveProposedAmount(
          await lpTwo.perpetual.getLpPosition(lpTwo.address),
          trader.market
        );

        await expect(
          lpTwo.clearingHouse.removeLiquidity(
            0,
            providedLiquidity,
            0,
            0,
            lp.usdc.address
          )
        )
          .to.emit(lpTwo.clearingHouse, 'LiquidityRemoved')
          .withArgs(0, lpTwo.address, providedLiquidity);

        const positionAfter = await lpTwo.perpetual.getLpPosition(
          lpTwo.address
        );

        // everything should be set to 0
        expect(positionAfter.liquidityBalance).to.be.equal(0);
        expect(positionAfter.cumFundingRate).to.be.equal(0);
        expect(positionAfter.positionSize).to.be.equal(0);
        expect(positionAfter.openNotional).to.be.equal(0);
      });
    });

    describe('Misc', async function () {
      it('Should emit provide liquidity event in the curve pool', async function () {
        const price = await lp.perpetual.indexPrice(); // valid for first deposit
        const liquidityWadAmount = await tokenToWad(
          await lp.vault.getReserveTokenDecimals(),
          liquidityAmountUSDC
        ); // deposited liquidity with 18 decimals

        const PRECISION = asBigNumber('1');
        await expect(
          lp.clearingHouse.provideLiquidity(
            0,
            liquidityAmountUSDC,
            lp.usdc.address
          )
        )
          .to.emit(lp.market, 'AddLiquidity')
          .withArgs(
            lp.perpetual.address,
            [liquidityWadAmount, liquidityWadAmount.mul(PRECISION).div(price)],
            0,
            0
          );
      });
      it('Market actions should generate dust', async function () {
        const liquidityAmount = await tokenToWad(6, liquidityAmountUSDC);

        // generate dust
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          liquidityAmount.div(1000),
          liquidityAmount.div(100),
          Side.Short
        );

        await provideLiquidity(lpTwo, lp.usdc, liquidityAmount);

        // closing position generates dust
        const eBaseDust = 47;
        const traderPosition = await trader.perpetual.getTraderPosition(
          trader.address
        );

        const tentativeQuoteAmount = await deriveProposedAmount(
          traderPosition,
          trader.market
        );
        await expect(
          trader.clearingHouse.reducePosition(0, tentativeQuoteAmount, 0)
        )
          .to.emit(trader.perpetual, 'DustGenerated')
          .withArgs(eBaseDust);

        expect(await lp.perpetual.getBaseDust()).to.be.eq(eBaseDust);
      });
    });
  });
});
