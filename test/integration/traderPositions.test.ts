import chaiModule = require('../chai-setup');
const {expect} = chaiModule;

import {utils, BigNumber} from 'ethers';
import env from 'hardhat';

import {rMul, rDiv} from './helpers/utils/calculations';
import {setup, funding, User} from './helpers/setup';
import {setUpPoolLiquidity} from './helpers/PerpetualUtils';
import {setNextBlockTimestamp} from '../../helpers/misc-utils';
import {Side} from './helpers/utils/types';

describe('Increment: open/close long/short trading positions', () => {
  let alice: User;
  let bob: User;
  let depositAmount: BigNumber;

  // protocol constants
  let MIN_MARGIN: BigNumber;
  let LIQUIDATION_FEE: BigNumber;
  let PRECISION: BigNumber;
  let TWAP_FREQUENCY: BigNumber;
  let FEE: BigNumber;
  let MIN_MARGIN_AT_CREATION: BigNumber;
  let VQUOTE_INDEX: BigNumber;
  let VBASE_INDEX: BigNumber;

  before('Get protocol constants', async () => {
    ({alice, bob} = await setup());

    MIN_MARGIN = await alice.perpetual.MIN_MARGIN();
    LIQUIDATION_FEE = await alice.perpetual.LIQUIDATION_FEE();
    PRECISION = await alice.perpetual.PRECISION();
    TWAP_FREQUENCY = await alice.perpetual.TWAP_FREQUENCY();
    FEE = await alice.perpetual.FEE();
    MIN_MARGIN_AT_CREATION = await alice.perpetual.MIN_MARGIN_AT_CREATION();
    VQUOTE_INDEX = await alice.perpetual.VQUOTE_INDEX();
    VBASE_INDEX = await alice.perpetual.VBASE_INDEX();
  });

  beforeEach(
    'Give Alice funds and approve transfer by the vault to her balance',
    async () => {
      ({alice} = await setup());
      depositAmount = await funding();

      await alice.usdc.approve(alice.vault.address, depositAmount);
    }
  );

  it('Should fail if the pool has no liquidity in it', async () => {
    await alice.perpetual.deposit(depositAmount.div(2), alice.usdc.address);
    // no error message as the code fails with the pool
    await expect(alice.perpetual.openPosition(depositAmount.div(2), Side.Long))
      .to.be.reverted;
  });

  it('Should fail if the amount is null', async () => {
    await expect(alice.perpetual.openPosition(0, Side.Long)).to.be.revertedWith(
      "The amount can't be null"
    );
  });

  it('Should fail if user already has an open position on this market', async () => {
    // set-up
    await setUpPoolLiquidity(bob, depositAmount);
    await alice.perpetual.deposit(depositAmount.div(2), alice.usdc.address);
    await alice.perpetual.openPosition(depositAmount.div(2), Side.Long);

    // try to create a new trader position for Alice
    await expect(
      alice.perpetual.openPosition(depositAmount, Side.Long)
    ).to.be.revertedWith('Cannot open a position with one already opened');
  });

  it('Should fail if user does not have enough funds deposited in the vault', async () => {
    await alice.perpetual.deposit(depositAmount, alice.usdc.address);

    const depositedAmount = await alice.vault.getReserveValue(alice.address);

    // get the position amount matching the exact limit of MIN_MARGIN_AT_CREATION
    const limitAmount = rDiv(depositedAmount, MIN_MARGIN_AT_CREATION);
    // add 1 to it to exceed the margin limit
    const exceedingAmount = limitAmount.add(1);

    await expect(
      alice.perpetual.openPosition(exceedingAmount, Side.Long)
    ).to.be.revertedWith(
      'Not enough funds in the vault for the margin of this position'
    );
  });

  async function _openAndCheckPosition(
    direction: Side,
    expectedQuoteBought: string
  ) {
    // set-up
    await setUpPoolLiquidity(bob, depositAmount);
    await alice.perpetual.deposit(depositAmount.div(2), alice.usdc.address);

    // expected values
    const nextBlockTimestamp = await setNextBlockTimestamp(env);
    const positionNotionalAmount = depositAmount.div(2).toString();

    await expect(alice.perpetual.openPosition(depositAmount.div(2), direction))
      .to.emit(alice.perpetual, 'OpenPosition')
      .withArgs(
        alice.address,
        nextBlockTimestamp,
        direction,
        positionNotionalAmount,
        expectedQuoteBought
      );

    const alicePosition = await alice.perpetual.getUserPosition(alice.address);
    expect(alicePosition.positionSize.toString()).to.equal(expectedQuoteBought);
    expect(alicePosition.notional.toString()).to.equal(positionNotionalAmount);
    expect(alicePosition.profit.toNumber()).to.equal(0);
    expect(alicePosition.side).to.equal(direction);
    expect(alicePosition.timeStamp.toNumber()).to.equal(nextBlockTimestamp);
    // cumFundingRate is set at 0 because there's no activity before in this test
    expect(alicePosition.cumFundingRate.toNumber()).to.equal(0);
  }

  it('Should open LONG position', async () => {
    const expectedQuoteBought = '44166136'; // this hardcoded value might break easily
    await _openAndCheckPosition(Side.Long, expectedQuoteBought);
  });

  it('Should open SHORT position', async () => {
    const expectedQuoteBought = '49974949'; // this hardcoded value might break easily
    await _openAndCheckPosition(Side.Short, expectedQuoteBought);
  });

  it('Should work if trader opens position after having closed one', async () => {
    // Alice opens and closes a position (without withdrawing her collateral)
    await setUpPoolLiquidity(bob, depositAmount);
    await alice.perpetual.deposit(depositAmount.div(2), alice.usdc.address);
    await alice.perpetual.openPosition(depositAmount.div(2), Side.Long);
    await alice.perpetual.closePosition();

    // expected values
    const nextBlockTimestamp = await setNextBlockTimestamp(env);
    const positionNotionalAmount = depositAmount.div(2).toString();

    await expect(alice.perpetual.openPosition(depositAmount.div(2), Side.Long))
      .to.emit(alice.perpetual, 'OpenPosition')
      .withArgs(
        alice.address,
        nextBlockTimestamp,
        Side.Long,
        positionNotionalAmount,
        '44166134' // this hardcoded value might break easily
      );
  });

  it('Should fail if callee has no opened position at the moment', async () => {
    await expect(alice.perpetual.closePosition()).to.be.revertedWith(
      'No position currently opened'
    );
  });

  it('Profit (or loss) should be reflected in the user balance in the Vault', async () => {
    // set-up
    await setUpPoolLiquidity(bob, depositAmount);
    await alice.perpetual.deposit(depositAmount.div(2), alice.usdc.address);

    const aliceVaultBalanceBeforeOpeningPosition = await alice.vault.getBalance(
      alice.address
    );

    await alice.perpetual.openPosition(depositAmount.div(2), Side.Short);
    await alice.perpetual.closePosition();

    const aliceTraderPosition = await alice.perpetual.getUserPosition(
      alice.address
    );
    expect(aliceTraderPosition.notional.toNumber()).to.equal(0);
    expect(aliceTraderPosition.positionSize.toNumber()).to.equal(0);

    // TraderPosition.profit should be reflected in the Vault user's balance
    const aliceVaultBalanceAfterClosingPosition = await alice.vault.getBalance(
      alice.address
    );
    const expectedAliceVaultBalanceAfterClosingPosition =
      aliceVaultBalanceBeforeOpeningPosition.add(aliceTraderPosition.profit);

    expect(
      aliceVaultBalanceAfterClosingPosition.eq(
        expectedAliceVaultBalanceAfterClosingPosition
      )
    ).to.be.true;
  });

  it('No exchange rate applied when opening and closing LONG positions', async () => {
    let aliceTraderPosition;

    // set-up
    await setUpPoolLiquidity(bob, depositAmount);
    await alice.perpetual.deposit(depositAmount.div(2), alice.usdc.address);

    const vQuoteLiquidityBeforePositionCreated = await alice.market.balances(
      VQUOTE_INDEX
    );

    await alice.perpetual.openPosition(depositAmount.div(2), Side.Long);

    const vQuoteLiquidityAfterPositionCreated = await alice.market.balances(
      VQUOTE_INDEX
    );
    aliceTraderPosition = await alice.perpetual.getUserPosition(alice.address);
    const alicePositionNotional = aliceTraderPosition.notional;
    // no exchange rate applied on the notional amount
    const expectedAdditionalVQuote = vQuoteLiquidityBeforePositionCreated.add(
      alicePositionNotional
    );

    expect(vQuoteLiquidityAfterPositionCreated.eq(expectedAdditionalVQuote)).to
      .be.true;

    await alice.perpetual.closePosition();
    const vQuoteLiquidityAfterPositionClosed = await alice.market.balances(
      VQUOTE_INDEX
    );

    aliceTraderPosition = await alice.perpetual.getUserPosition(alice.address);

    // user.profit = vQuoteProceeds - user.notional
    // vQuoteProceeds = user.profit + user.notional
    const alicePositionProfitAfterClose = (
      await alice.perpetual.getUserPosition(alice.address)
    ).profit;
    const expectedVQuoteProceeds = alicePositionProfitAfterClose.add(
      alicePositionNotional
    );

    // vQuoteReceived = vQuoteBalanceBeforePositionSold - vQuoteBalanceAfterPositionExited
    const vQuoteReceived = vQuoteLiquidityAfterPositionCreated.sub(
      vQuoteLiquidityAfterPositionClosed
    );

    // vQuoteReceived = expectedVQuoteProceeds means that no exchange rate has been applied
    // when closing the position
    expect(expectedVQuoteProceeds.eq(vQuoteReceived));
  });

  it('EUR_USD exchange rate applied when opening and closing SHORT position', async () => {
    const alicePositionNominalSize = depositAmount.div(2);
    const EUR_USD = await alice.perpetual.indexPrice();

    // set-up
    await setUpPoolLiquidity(bob, depositAmount);
    await alice.perpetual.deposit(alicePositionNominalSize, alice.usdc.address);

    const vBaseLiquidityBeforePositionCreated = await alice.market.balances(
      VBASE_INDEX
    );

    await alice.perpetual.openPosition(alicePositionNominalSize, Side.Short);

    const vBaseLiquidityAfterPositionCreated = await alice.market.balances(
      VBASE_INDEX
    );
    const alicePositionNotional = (
      await alice.perpetual.getUserPosition(alice.address)
    ).notional;

    // verify that EUR_USD exchange rate is applied to alicePositionNominalSize
    // vBaseLiquidityAfterPositionCreated = vBaseLiquidityBeforePositionCreated - rDiv(alicePositionNominalSize, EUR_USD)

    const alicePositionInEuro = rDiv(alicePositionNominalSize, EUR_USD);
    const expectedVBaseLiquidityAfterPositionCreated =
      vBaseLiquidityBeforePositionCreated.add(alicePositionInEuro);

    expect(
      vBaseLiquidityAfterPositionCreated.eq(
        expectedVBaseLiquidityAfterPositionCreated
      )
    ).to.be.true;

    await alice.perpetual.closePosition();

    const vBaseLiquidityAfterPositionClosed = await alice.market.balances(
      VBASE_INDEX
    );

    // expectedVBaseReceived = rMul((user.profit + user.notional), EUR_USD)
    const alicePositionProfit = (
      await alice.perpetual.getUserPosition(alice.address)
    ).profit;
    const expectedVQuoteProceeds = alicePositionProfit.add(
      alicePositionNotional
    );
    const expectedVBaseReceived = rDiv(expectedVQuoteProceeds, EUR_USD);

    // expectedVBaseReceived = vBaseLiquidityAfterPositionCreated - vBaseLiquidityAfterPositionClosed
    const vBaseLiquidityDiff = vBaseLiquidityAfterPositionCreated.sub(
      vBaseLiquidityAfterPositionClosed
    );

    expect(vBaseLiquidityDiff.eq(expectedVBaseReceived)).to.be.true;
  });

  //TODO: add tests to assert the impact of the funding rate on the profit
});
