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
  getLatestTimestamp,
} from '../../helpers/misc-utils';
import {getChainlinkPrice} from '../../helpers/contracts-getters';
import {asBigNumber, rDiv, rMul} from '../helpers/utils/calculations';
import {DEAD_ADDRESS, FULL_REDUCTION_RATIO} from '../../helpers/constants';
import {Side} from '../helpers/utils/types';

import {
  removeLiquidityProposedAmount,
  extendPositionWithCollateral,
  provideLiquidity,
  deriveCloseProposedAmount,
  liquidityProviderProposedAmount,
} from '../helpers/PerpetualUtils';

describe('Increment App: Liquidity', function () {
  let lp: User, lpTwo: User, trader: User;
  let liquidityAmountUSDC: BigNumber;

  // constants
  // const MIN_MINT_AMOUNT = BigNumber.from(0);

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
        lp.clearingHouse.provideLiquidity(0, 0, 0, lp.usdc.address)
      ).to.be.revertedWith('Zero amount');
    });

    it('Should allow to deposit positive, emit event', async function () {
      await expect(
        lp.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC,
          0,
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

    it('Should allow to deposit twice', async function () {
      await lp.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC.div(2),
        0,
        lp.usdc.address
      );

      await expect(
        lp.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC.div(2),
          0,
          lp.usdc.address
        )
      ).to.not.be.reverted;
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
      await lp.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC,
        0,
        lp.usdc.address
      );

      // after you deposit
      /* relative price should not change */
      expect(await lp.perpetual.marketPrice()).to.be.equal(price);

      /* balances should increment */
      expect(await lp.vQuote.balanceOf(lp.market.address)).to.be.equal(
        vQuoteBefore.add(liquidityWadAmount)
      );
      expect(await lp.vBase.balanceOf(lp.market.address)).to.be.equal(
        vBaseBefore.add(rDiv(liquidityWadAmount, price))
      );
      expect(await lp.market.balances(0)).to.be.equal(
        vQuotelpBalance.add(liquidityWadAmount)
      );
      expect(await lp.market.balances(1)).to.be.equal(
        vBaselpBalance.add(rDiv(liquidityWadAmount, price))
      );

      /* should have correct balance in perpetual */
      const lpBalance = await lp.perpetual.getLpPosition(lp.address);
      expect(lpBalance.openNotional.mul(-1)).to.be.equal(liquidityWadAmount);
      expect(lpBalance.positionSize.mul(-1)).to.be.equal(
        rDiv(liquidityWadAmount, price)
      );

      expect(lpBalance.liquidityBalance).to.be.equal(
        await lp.curveToken.balanceOf(lp.perpetual.address)
      );
      expect(await lp.perpetual.getTotalLiquidityProvided()).to.be.equal(
        await lp.curveToken.balanceOf(lp.perpetual.address)
      );
    });

    it('Should allow multiple deposits from one account', async function () {
      // set global.cumFundingRate
      let anteriorTimestamp = (await getLatestTimestamp(env)) - 15;
      await lp.perpetual.__TestPerpetual_setGlobalPosition(
        anteriorTimestamp,
        asBigNumber('100') // set any cumFundingRate != 0
      );

      // lp deposits some assets
      await lp.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC.div(2),
        0,
        lp.usdc.address
      );

      // trade some assets to change the ratio in the pool
      const depositAmount = liquidityAmountUSDC.div(20);
      await trader.clearingHouse.deposit(0, depositAmount, trader.usdc.address);
      await trader.clearingHouse.extendPosition(
        0,
        depositAmount.mul(2),
        Side.Long,
        0
      );
      const traderBalance = await trader.perpetual.getTraderPosition(
        trader.address
      );

      // before depositing more liquidity
      const vBaseBefore = await lp.vBase.balanceOf(lp.market.address);
      const vQuoteBefore = await lp.vQuote.balanceOf(lp.market.address);
      const vBaselpBalance = await lp.market.balances(1);
      const vQuotelpBalance = await lp.market.balances(0);
      expect(vBaseBefore).to.be.equal(vBaselpBalance);
      expect(vQuoteBefore).to.be.equal(vQuotelpBalance);

      const priceBefore = rDiv(vQuoteBefore, vBaseBefore);
      const liquidityWadAmount = await tokenToWad(
        await lp.vault.getReserveTokenDecimals(),
        liquidityAmountUSDC.div(2)
      ); // deposited liquidity with 18 decimals

      // set new global state
      anteriorTimestamp += 10;
      await lp.perpetual.__TestPerpetual_setGlobalPosition(
        anteriorTimestamp,
        asBigNumber('200').mul(-1) // set any cumFundingRate different than the one before
      );

      // deposit more liquidity
      await lp.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC.div(2),
        0,
        lp.usdc.address
      );

      /* balances should increment */
      expect(await lp.vQuote.balanceOf(lp.market.address)).to.be.equal(
        vQuoteBefore.add(liquidityWadAmount)
      );
      expect(await lp.vBase.balanceOf(lp.market.address)).to.be.equal(
        vBaseBefore.add(rDiv(liquidityWadAmount, priceBefore))
      );
      expect(await lp.market.balances(1)).to.be.equal(
        vBaselpBalance.add(rDiv(liquidityWadAmount, priceBefore))
      );
      expect(await lp.market.balances(0)).to.be.equal(
        vQuotelpBalance.add(liquidityWadAmount)
      );

      /* should have correct balance in perpetual */
      const lpBalance = await lp.perpetual.getLpPosition(lp.address);
      expect(lpBalance.openNotional.mul(-1)).to.be.equal(
        vQuoteBefore.add(liquidityWadAmount).add(traderBalance.openNotional)
      );
      expect(lpBalance.positionSize.mul(-1)).to.be.equal(
        vBaseBefore
          .add(rDiv(liquidityWadAmount, priceBefore))
          .add(traderBalance.positionSize)
      );

      expect(lpBalance.liquidityBalance).to.be.equal(
        await lp.curveToken.balanceOf(lp.perpetual.address)
      );
      expect(await lp.perpetual.getTotalLiquidityProvided()).to.be.equal(
        await lp.curveToken.balanceOf(lp.perpetual.address)
      );
    });

    it('Should split subsequent deposits according to current ratio in pool', async function () {
      // lp deposits some assets
      await lp.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC,
        0,
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
        0,
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
  });
  describe('Can withdraw liquidity from the curve pool', async function () {
    it('Should not allow to withdraw liquidity when non provided', async function () {
      await expect(
        lp.clearingHouse.removeLiquidity(
          0,
          asBigNumber('1'),
          FULL_REDUCTION_RATIO,
          0,
          [0, 0],
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
        0,
        lp.usdc.address
      );

      // try withdraw
      const providedLiquidity = (await lp.perpetual.getLpPosition(lp.address))
        .liquidityBalance;

      await expect(
        lp.clearingHouse.removeLiquidity(
          0,
          providedLiquidity.add(BigNumber.from('1')),
          FULL_REDUCTION_RATIO,
          0,
          [0, 0],
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
        0,
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
          FULL_REDUCTION_RATIO,
          0,
          [0, 0],
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
        0,
        lp.usdc.address
      );

      // add extra liquidity else, the amounts of lp.openNotional and lp.positionSize are too small (respectively -2
      // and -1) for market.exchange to work when closing the PnL of the position
      await lpTwo.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC,
        0,
        lpTwo.usdc.address
      );

      // withdraw
      const lpBalance = await lpTwo.perpetual.getLpPosition(lpTwo.address);

      const perpetualVQuoteAmountBeforeWithdraw = await lpTwo.vQuote.balanceOf(
        lpTwo.perpetual.address
      );

      const proposedAmount = await liquidityProviderProposedAmount(
        lpBalance,
        lp.market
      );
      await lpTwo.clearingHouse.removeLiquidity(
        0,
        lpBalance.liquidityBalance,
        FULL_REDUCTION_RATIO,
        proposedAmount,
        [0, 0],
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

    it('Should remove and withdraw liquidity from pool, then delete LP position', async function () {
      // deposit
      await lp.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC,
        0,
        lp.usdc.address
      );

      // add extra liquidity else, the amounts of lp.openNotional and lp.positionSize are too small (respectively -2
      // and -1) for market.exchange to work when closing the PnL of the position
      await lpTwo.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC,
        0,
        lpTwo.usdc.address
      );

      // withdraw
      const lpPosition = await lpTwo.perpetual.getLpPosition(lp.address);

      const proposedAmount = await liquidityProviderProposedAmount(
        lpPosition,
        trader.market
      );

      await lp.clearingHouse.removeLiquidity(
        0,
        lpPosition.liquidityBalance,
        FULL_REDUCTION_RATIO,
        proposedAmount,
        [0, 0],
        0,
        lp.usdc.address
      );

      const positionAfter = await lp.perpetual.getLpPosition(lp.address);
      // everything should be set to 0
      expect(positionAfter.liquidityBalance).to.be.equal(0);
      expect(positionAfter.cumFundingRate).to.be.equal(0);
      expect(positionAfter.positionSize).to.be.equal(0);
      expect(positionAfter.openNotional).to.be.equal(0);
    });

    it.skip('Should allow LP to remove liquidity partially', async function () {
      // deposit
      await lp.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC,
        0,
        lp.usdc.address
      );

      // add extra liquidity else, the amounts of lp.openNotional and lp.positionSize are too small (respectively -2
      // and -1) for market.exchange to work when closing the PnL of the position
      await lpTwo.clearingHouse.provideLiquidity(
        0,
        liquidityAmountUSDC,
        0,
        lpTwo.usdc.address
      );

      // first partial withdraw
      const initialLpPosition = await lpTwo.perpetual.getLpPosition(lp.address);

      const firstProposedAmountToClosePosition =
        await liquidityProviderProposedAmount(initialLpPosition, trader.market);

      await lp.clearingHouse.removeLiquidity(
        0,
        initialLpPosition.liquidityBalance.div(2),
        FULL_REDUCTION_RATIO.div(2),
        firstProposedAmountToClosePosition.div(2),
        [0, 0],
        0,
        lp.usdc.address
      );

      // second withdraw, full withdraw this time

      const secondLpPosition = await lpTwo.perpetual.getLpPosition(lp.address);

      const secondProposedAmountToClosePosition =
        await liquidityProviderProposedAmount(secondLpPosition, trader.market);

      await lp.clearingHouse.removeLiquidity(
        0,
        secondLpPosition.liquidityBalance,
        FULL_REDUCTION_RATIO,
        secondProposedAmountToClosePosition,
        [0, 0],
        0,
        lp.usdc.address
      );

      const positionAfterSecondWithdrawal = await lp.perpetual.getLpPosition(
        lp.address
      );

      // everything should now be set to 0
      expect(positionAfterSecondWithdrawal.liquidityBalance).to.be.equal(0);
      expect(positionAfterSecondWithdrawal.cumFundingRate).to.be.equal(0);
      expect(positionAfterSecondWithdrawal.positionSize).to.be.equal(0);
      expect(positionAfterSecondWithdrawal.openNotional).to.be.equal(0);
    });

    async function setPrice(user: User, price: BigNumber) {
      await (
        await user.perpetual.__TestPerpetual_setBlockStartPrice(price)
      ).wait();
      await (
        await user.perpetual.__TestPerpetual_setTWAP(
          price,
          await user.perpetual.getOracleTwap()
        )
      ).wait();
    }

    async function driveDownMarketPrice(user: User) {
      // drive down market price (to change ratios in the pool)
      await user.perpetual.__TestPerpetual_manipulate_market(
        1,
        0,
        asBigNumber('11000')
      );

      // important: set new blockLastPrice / twap to circumvent trade restrictions
      await setPrice(user, await user.perpetual.marketPrice());

      // make a small trade (TODO: not sure why that has to be done)
      await user.perpetual.__TestPerpetual_manipulate_market(
        1,
        0,
        asBigNumber('1')
      );
    }

    async function driveUpMarketPrice(user: User) {
      // drive up market price (to change ratios in the pool)
      await user.perpetual.__TestPerpetual_manipulate_market(
        0,
        1,
        asBigNumber('11000')
      );

      // important: set new blockLastPrice / twap to circumvent trade restrictions
      await setPrice(user, await user.perpetual.marketPrice());

      // make a small trade (TODO: not sure why that has to be done)
      await user.perpetual.__TestPerpetual_manipulate_market(
        0,
        1,
        asBigNumber('1')
      );
    }

    it.skip('Liquidity provider generate profit (loss) in USD (EUR) when EUR/USD goes up', async function () {
      /* TODO: find out if the loss can exceed the collateral (under realistic conditions)
               is most likely easier with fuzzing
      */
      // init
      const liquidityAmount = await tokenToWad(6, liquidityAmountUSDC);
      await provideLiquidity(lp, lp.usdc, liquidityAmount);
      await provideLiquidity(trader, trader.usdc, liquidityAmount);

      // deposit initial liquidity
      const liquidityAmountTwo = liquidityAmount.div(1000); // small amount to avoid trade restrictions
      const lpBalanceBefore = await lpTwo.usdc.balanceOf(lpTwo.address);
      const lpBalanceBeforeEUR = rDiv(
        lpBalanceBefore,
        await lp.perpetual.marketPrice()
      );

      await provideLiquidity(lpTwo, lp.usdc, liquidityAmountTwo);

      // change market prices
      await driveUpMarketPrice(lpTwo);

      // withdraw liquidity
      const lpTwoPosition = await lpTwo.perpetual.getLpPosition(lpTwo.address);
      await lpTwo.clearingHouse.removeLiquidity(
        0,
        rMul(FULL_REDUCTION_RATIO, lpTwoPosition.liquidityBalance),
        FULL_REDUCTION_RATIO,
        (
          await removeLiquidityProposedAmount(
            lpTwoPosition,
            FULL_REDUCTION_RATIO,
            lpTwo.market
          )
        ).sub(1), // since prbMath subtracts one wei
        [0, 0],
        0,
        lpTwo.usdc.address
      );

      // everything should now be set to 0
      const positionAfter = await lpTwo.perpetual.getLpPosition(lpTwo.address);
      expect(positionAfter.liquidityBalance).to.be.equal(0);
      expect(positionAfter.positionSize).to.be.equal(0);
      expect(positionAfter.cumFundingRate).to.be.equal(0);
      expect(positionAfter.openNotional).to.be.equal(0);

      // USD profit
      const lpBalanceAfter = await lpTwo.usdc.balanceOf(lpTwo.address);
      expect(lpBalanceAfter).to.be.gt(lpBalanceBefore);

      // EUR loss
      const lpBalanceAfterEUR = rDiv(
        lpBalanceAfter,
        await lp.perpetual.marketPrice()
      );
      expect(lpBalanceAfterEUR).to.be.lt(lpBalanceBeforeEUR);
    });
    it.skip('Liquidity provider can generate a loss (in USD) when EUR/USD goes down', async function () {
      /* TODO: find out if the loss can exceed the collateral (under realistic conditions)
               is most likely easier with fuzzing
      */
      // init

      const liquidityAmount = await tokenToWad(6, liquidityAmountUSDC);
      await provideLiquidity(lp, lp.usdc, liquidityAmount);
      await provideLiquidity(trader, trader.usdc, liquidityAmount);

      // deposit initial liquidity
      const liquidityAmountTwo = liquidityAmount.div(1000); // small amount to avoid trade restrictions
      const lpBalanceBefore = await lpTwo.usdc.balanceOf(lpTwo.address);

      const lpBalanceBeforeEUR = rDiv(
        lpBalanceBefore,
        await lp.perpetual.marketPrice()
      );

      await provideLiquidity(lpTwo, lp.usdc, liquidityAmountTwo);

      // change market prices
      await driveDownMarketPrice(lpTwo);

      // withdraw liquidity
      const lpTwoPosition = await lpTwo.perpetual.getLpPosition(lpTwo.address);
      await lpTwo.clearingHouse.removeLiquidity(
        0,
        rMul(FULL_REDUCTION_RATIO, lpTwoPosition.liquidityBalance),
        FULL_REDUCTION_RATIO,
        (
          await removeLiquidityProposedAmount(
            lpTwoPosition,
            FULL_REDUCTION_RATIO,
            lpTwo.market
          )
        ).sub(1), // since prbMath subtracts one wei
        [0, 0],
        0,
        lpTwo.usdc.address
      );
      // everything should now be set to 0
      const positionAfter = await lpTwo.perpetual.getLpPosition(lpTwo.address);
      expect(positionAfter.liquidityBalance).to.be.equal(0);
      expect(positionAfter.positionSize).to.be.equal(0);
      expect(positionAfter.cumFundingRate).to.be.equal(0);
      expect(positionAfter.openNotional).to.be.equal(0);

      // USD profit
      const lpBalanceAfter = await lpTwo.usdc.balanceOf(lpTwo.address);
      expect(lpBalanceAfter).to.be.lt(lpBalanceBefore);

      // EUR loss
      const lpBalanceAfterEUR = rDiv(
        lpBalanceAfter,
        await lp.perpetual.marketPrice()
      );
      expect(lpBalanceAfterEUR).to.be.gt(lpBalanceBeforeEUR);
    });
    it('Should revert when not enough liquidity tokens are minted', async function () {
      // init
      const liquidityAmount = await tokenToWad(6, liquidityAmountUSDC);
      await provideLiquidity(lp, lp.usdc, liquidityAmount);

      // provide liquidity uses minAmount
      const eLpTokens = await lp.market.calc_token_amount([
        liquidityAmount,
        rDiv(liquidityAmount, await lp.market.last_prices()),
      ]);
      await lpTwo.usdc.approve(lpTwo.vault.address, liquidityAmountUSDC);

      await expect(
        lpTwo.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC,
          eLpTokens.add(1).add(1), // add 1 wei since one wei is subtracted inside curve
          lpTwo.usdc.address
        )
      ).to.be.revertedWith('');

      await expect(
        lpTwo.clearingHouse.provideLiquidity(
          0,
          liquidityAmountUSDC,
          eLpTokens,
          lpTwo.usdc.address
        )
      ).to.not.be.reverted;
    });
    it('Should revert when not enough virtual tokens are released', async function () {
      // init
      const liquidityAmount = await tokenToWad(6, liquidityAmountUSDC);
      await provideLiquidity(lpTwo, lpTwo.usdc, liquidityAmount);
      await provideLiquidity(lp, lp.usdc, liquidityAmount);

      // attempt withdrawal
      const lpPosition = await lp.perpetual.getLpPosition(lp.address);

      const eWithdrawnQuoteTokens = (await lp.market.balances(0))
        .mul(lpPosition.liquidityBalance)
        .div(await lp.perpetual.getTotalLiquidityProvided())
        .sub(1);
      const eWithdrawnBaseTokens = (await lp.market.balances(1))
        .mul(lpPosition.liquidityBalance)
        .div(await lp.perpetual.getTotalLiquidityProvided())
        .sub(1);

      const proposedAmount = await liquidityProviderProposedAmount(
        lpPosition,
        lp.market
      );

      await expect(
        lp.clearingHouse.removeLiquidity(
          0,
          lpPosition.liquidityBalance,
          FULL_REDUCTION_RATIO,
          proposedAmount,
          [eWithdrawnQuoteTokens.add(1), eWithdrawnBaseTokens.add(1)],
          0,
          lp.usdc.address
        )
      ).to.be.revertedWith('');

      await expect(
        lp.clearingHouse.removeLiquidity(
          0,
          lpPosition.liquidityBalance,
          FULL_REDUCTION_RATIO,
          proposedAmount,
          [eWithdrawnQuoteTokens, eWithdrawnBaseTokens],
          0,
          lp.usdc.address
        )
      ).to.not.be.reverted;
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
          0,
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
      const eBaseDust = 5095;
      const traderPosition = await trader.perpetual.getTraderPosition(
        trader.address
      );

      const closeProposedAmount = await deriveCloseProposedAmount(
        traderPosition,
        trader.market
      );
      const fullReductionRatio = ethers.utils.parseEther('1');
      await expect(
        trader.clearingHouse.reducePosition(
          0,
          fullReductionRatio,
          closeProposedAmount,
          0
        )
      )
        .to.emit(trader.perpetual, 'DustGenerated')
        .withArgs(eBaseDust);

      expect(await lp.clearingHouseViewer.getBaseDust(0)).to.be.eq(
        (await lp.perpetual.getTraderPosition(lp.clearingHouse.address))
          .positionSize
      );
      expect(await lp.clearingHouseViewer.getBaseDust(0)).to.be.eq(eBaseDust);
    });

    // Unrealistic because pool/market should never be empty
    // it.skip('Should remove correct amount of liquidity from pool', async function () {
    //   // deposit
    //   await lp.clearingHouse.provideLiquidity(
    //     0,
    //     liquidityAmountUSDC,
    //     lp.usdc.address
    //   );
    //   const lpBalanceAfter = await lp.usdc.balanceOf(lp.address);
    //   expect(lpBalanceAfter).to.be.equal(0);

    //   // withdraw
    //   const positionBefore = await lp.perpetual.getLpPosition(lp.address);

    //   const dust = await TEST_dust_remove_liquidity(
    //     // dust balances remaining in contract
    //     lp.market,
    //     positionBefore.liquidityBalance,
    //     [MIN_MINT_AMOUNT, MIN_MINT_AMOUNT]
    //   );

    //   await expect(
    //     lp.clearingHouse.removeLiquidity(
    //       0,
    //       positionBefore.liquidityBalance,
    //       FULL_REDUCTION_RATIO,
    //       0,
    //       0,
    //       lp.usdc.address
    //     )
    //   )
    //     .to.emit(lp.clearingHouse, 'LiquidityRemoved')
    //     .withArgs(0, lp.address, positionBefore.liquidityBalance);

    //   const positionAfter = await lp.perpetual.getLpPosition(lp.address);

    //   expect(positionAfter.liquidityBalance).to.be.equal(0);
    //   expect(positionAfter.cumFundingRate).to.be.equal(0);
    //   expect(positionAfter.positionSize).to.be.equal(-dust.base);
    //   expect(positionAfter.openNotional).to.be.equal(-dust.quote);
    // });
  });
});
