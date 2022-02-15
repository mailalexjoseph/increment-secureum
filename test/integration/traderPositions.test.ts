import {expect} from 'chai';
import {utils, BigNumber, ethers} from 'ethers';
import env from 'hardhat';

import {rMul, rDiv} from '../helpers/utils/calculations';
import {setup, funding, User} from '../helpers/setup';
import {setUpPoolLiquidity} from '../helpers/PerpetualUtils';
import {setNextBlockTimestamp} from '../../helpers/misc-utils';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {Side} from '../helpers/utils/types';

describe('Increment: open/close long/short trading positions', () => {
  let alice: User;
  let bob: User;
  let depositAmountUSDC: BigNumber;
  let depositAmount: BigNumber; // with 1e18 decimals
  let aliceUSDCAmount: BigNumber;

  // protocol constants
  let MIN_MARGIN: BigNumber;
  let LIQUIDATION_REWARD: BigNumber;
  let TWAP_FREQUENCY: BigNumber;
  let FEE: BigNumber;
  let MIN_MARGIN_AT_CREATION: BigNumber;
  let VQUOTE_INDEX: BigNumber;
  let VBASE_INDEX: BigNumber;

  before('Get protocol constants', async () => {
    const {deployer} = await setup();

    MIN_MARGIN = await deployer.perpetual.MIN_MARGIN();
    LIQUIDATION_REWARD = await deployer.perpetual.LIQUIDATION_REWARD();
    TWAP_FREQUENCY = await deployer.perpetual.TWAP_FREQUENCY();
    FEE = await deployer.perpetual.FEE();
    MIN_MARGIN_AT_CREATION = await deployer.perpetual.MIN_MARGIN_AT_CREATION();
    VQUOTE_INDEX = await deployer.perpetual.VQUOTE_INDEX();
    VBASE_INDEX = await deployer.perpetual.VBASE_INDEX();
  });

  beforeEach(
    'Give Alice funds and approve transfer by the vault to her balance',
    async () => {
      ({alice, bob} = await setup());
      depositAmountUSDC = await funding(); // amount used for collaterals and liquidity provisioning
      depositAmount = await tokenToWad(
        await alice.vault.getReserveTokenDecimals(),
        depositAmountUSDC
      );
      aliceUSDCAmount = depositAmountUSDC.div(10); // Alice deposits and exchanges 10% of the pool liquidity

      await alice.usdc.approve(alice.vault.address, depositAmount);
    }
  );

  it('Should fail if the pool has no liquidity in it', async () => {
    await alice.perpetual.deposit(depositAmountUSDC, alice.usdc.address);
    // no error message as the code fails with the pool
    await expect(
      alice.perpetual.openPositionWithUSDC(aliceUSDCAmount, Side.Long)
    )
      .to.emit(alice.perpetual, 'Log')
      .withArgs(
        'Incorrect amount, submit a bigger value or one matching more closely the amount of vQuote needed to perform the exchange'
      );
  });

  it('Should fail if the amount is null', async () => {
    await expect(
      alice.perpetual.openPositionWithUSDC(0, Side.Long)
    ).to.be.revertedWith("The amount can't be null");
  });

  it('Should fail if user already has an open position on this market', async () => {
    // set-up
    await setUpPoolLiquidity(bob, depositAmountUSDC.div(2));
    await alice.perpetual.deposit(depositAmountUSDC, alice.usdc.address);
    await alice.perpetual.openPositionWithUSDC(aliceUSDCAmount, Side.Long);

    // try to create a new trader position for Alice
    await expect(
      alice.perpetual.openPositionWithUSDC(aliceUSDCAmount, Side.Long)
    ).to.be.revertedWith('Cannot open a position with one already opened');
  });

  it('Should fail if user does not have enough funds deposited in the vault', async () => {
    await setUpPoolLiquidity(bob, depositAmountUSDC.div(2));
    await alice.perpetual.deposit(depositAmountUSDC, alice.usdc.address);

    // swap succeeds, then it fails when opening the position
    await expect(
      alice.perpetual.openPosition(depositAmount.mul(10), Side.Long)
    ).to.be.revertedWith('Not enough margin');
  });

  async function _openAndCheckPosition(
    direction: Side,
    expectedTokensBought: string
  ) {
    // set-up
    await setUpPoolLiquidity(bob, depositAmountUSDC.div(2));
    await alice.perpetual.deposit(depositAmountUSDC, alice.usdc.address);

    // expected values
    let tokenSold = await tokenToWad(
      await alice.vault.getReserveTokenDecimals(),
      aliceUSDCAmount
    );

    const nextBlockTimestamp = await setNextBlockTimestamp(env);

    let positionSize, notionalAmount;
    if (direction === Side.Long) {
      positionSize = expectedTokensBought;
      notionalAmount = tokenSold.mul(-1);
    } else {
      const EURUSDChainlinkPrice = await alice.perpetual.indexPrice();

      tokenSold = rDiv(tokenSold, EURUSDChainlinkPrice);
      notionalAmount = expectedTokensBought;
      positionSize = tokenSold.mul(-1);
    }

    await expect(alice.perpetual.openPosition(tokenSold, direction))
      .to.emit(alice.perpetual, 'OpenPosition')
      .withArgs(
        alice.address,
        nextBlockTimestamp,
        direction,
        notionalAmount,
        positionSize
      );

    const alicePosition = await alice.perpetual.getTraderPosition(
      alice.address
    );
    expect(alicePosition.positionSize).to.be.equal(positionSize);
    expect(alicePosition.openNotional).to.be.equal(notionalAmount);
    // cumFundingRate is set at 0 because there's no activity before in this test
    expect(alicePosition.cumFundingRate).to.be.equal(0);

    // the USDC amount (with 6 decimals) must be converted to 18 decimals
    expect(
      alicePosition.openNotional.abs().div(ethers.utils.parseEther('1'))
    ).to.be.above(ethers.BigNumber.from('1'));
  }

  it('Should open LONG position', async () => {
    // slippage is significant as Alice exchanges 10% of the liquidity of the pool
    const expectedSharesBought = '7788801268869637352'; // vBase amount
    await _openAndCheckPosition(Side.Long, expectedSharesBought);
  });

  it('Should open SHORT position', async () => {
    // slippage is significant as Alice exchanges 10% of the liquidity of the pool
    const expectedSharesBought = '8838809567925953140'; // vQuote amount
    await _openAndCheckPosition(Side.Short, expectedSharesBought);
  });

  it('Should work if trader opens position after having closed one', async () => {
    await setUpPoolLiquidity(bob, depositAmountUSDC.div(2));
    await alice.perpetual.deposit(depositAmountUSDC, alice.usdc.address);
    await alice.perpetual.openPosition(depositAmount, Side.Long);
    await alice.perpetual.closePosition(0);

    // expected values
    const positionNotionalAmount = await tokenToWad(
      await alice.vault.getReserveTokenDecimals(),
      aliceUSDCAmount
    );

    const nextBlockTimestamp = await setNextBlockTimestamp(env);
    await expect(alice.perpetual.openPosition(depositAmount.div(10), Side.Long))
      .to.emit(alice.perpetual, 'OpenPosition')
      .withArgs(
        alice.address,
        nextBlockTimestamp,
        Side.Long,
        positionNotionalAmount.mul(-1),
        '7732665341504984598' // very brittle
      );
  });

  it('Should fail if callee has no opened position at the moment', async () => {
    await expect(alice.perpetual.closePosition(0)).to.be.revertedWith(
      'No position currently opened'
    );
  });

  it('Profit (or loss) should be reflected in the user balance in the Vault', async () => {
    // set-up
    await setUpPoolLiquidity(bob, depositAmountUSDC.div(2));
    await alice.perpetual.deposit(depositAmountUSDC, alice.usdc.address);

    const aliceVaultBalanceBeforeOpeningPosition = await alice.vault.getBalance(
      alice.address
    );

    await alice.perpetual.openPosition(depositAmount.div(10), Side.Short);
    await alice.perpetual.closePosition(
      (
        await alice.perpetual.getTraderPosition(alice.address)
      ).positionSize.mul(-1) // because it's a short position
    );

    const aliceUserPosition = await alice.perpetual.getTraderPosition(
      alice.address
    );
    expect(aliceUserPosition.openNotional.toNumber()).to.equal(0);
    expect(aliceUserPosition.positionSize.toNumber()).to.equal(0);

    // Profit should be reflected in the Vault user's balance
    const aliceVaultBalanceAfterClosingPosition = await alice.vault.getBalance(
      alice.address
    );

    expect(aliceVaultBalanceBeforeOpeningPosition).to.not.equal(
      aliceVaultBalanceAfterClosingPosition
    );
  });

  it('No exchange rate applied for LONG positions', async () => {
    // set-up
    await setUpPoolLiquidity(bob, depositAmountUSDC.div(2));
    await alice.perpetual.deposit(depositAmountUSDC, alice.usdc.address);

    const vQuoteLiquidityBeforePositionCreated = await alice.market.balances(
      VQUOTE_INDEX
    );

    await alice.perpetual.openPosition(depositAmount.div(10), Side.Long);

    const vQuoteLiquidityAfterPositionCreated = await alice.market.balances(
      VQUOTE_INDEX
    );
    const aliceUserPosition = await alice.perpetual.getTraderPosition(
      alice.address
    );
    const aliceOpenNotional = aliceUserPosition.openNotional;
    const expectedAdditionalVQuote = vQuoteLiquidityBeforePositionCreated.add(
      aliceOpenNotional.mul(-1)
    );

    const initialVaultBalance = await alice.vault.getBalance(alice.address);
    expect(vQuoteLiquidityAfterPositionCreated).to.equal(
      expectedAdditionalVQuote
    );

    await alice.perpetual.closePosition(0);
    const vQuoteLiquidityAfterPositionClosed = await alice.market.balances(
      VQUOTE_INDEX
    );

    const vQuoteReceived = vQuoteLiquidityAfterPositionCreated.sub(
      vQuoteLiquidityAfterPositionClosed
    );

    const expectedProfit = vQuoteReceived.add(aliceOpenNotional);

    const expectedNewVaultBalance = initialVaultBalance.add(expectedProfit);

    const newVaultBalance = await alice.vault.getBalance(alice.address);

    expect(expectedNewVaultBalance).to.equal(newVaultBalance);
  });

  it('No exchange rate applied for SHORT positions', async () => {
    // set-up
    await setUpPoolLiquidity(bob, depositAmountUSDC.div(2));
    await alice.perpetual.deposit(depositAmountUSDC, alice.usdc.address);
    const initialVaultBalance = await alice.vault.getBalance(alice.address);

    const vQuoteLiquidityBeforePositionCreated = await alice.market.balances(
      VQUOTE_INDEX
    );

    await alice.perpetual.openPosition(depositAmount.div(10), Side.Short);

    const vQuoteLiquidityAfterPositionCreated = await alice.market.balances(
      VQUOTE_INDEX
    );
    const aliceUserPosition = await alice.perpetual.getTraderPosition(
      alice.address
    );
    const aliceOpenNotional = aliceUserPosition.openNotional;
    const expectedVQuoteLiquidityAfterPositionOpened =
      vQuoteLiquidityBeforePositionCreated.sub(aliceOpenNotional);

    expect(vQuoteLiquidityAfterPositionCreated).to.equal(
      expectedVQuoteLiquidityAfterPositionOpened
    );

    // the amount passed to `closePosition` is arbitrary,
    // though large enough to be able to buy the same of amount of vBase short
    const vQuoteAmountToBuyBackVBasePosition = aliceOpenNotional.add(
      aliceOpenNotional.div(4)
    );
    await alice.perpetual.closePosition(vQuoteAmountToBuyBackVBasePosition);

    const vQuoteLiquidityAfterPositionClosed = await alice.market.balances(
      VQUOTE_INDEX
    );

    const vQuoteReceived = vQuoteLiquidityAfterPositionCreated.sub(
      vQuoteLiquidityAfterPositionClosed
    );

    const expectedProfit = vQuoteReceived.add(aliceOpenNotional);

    const expectedNewVaultBalance = initialVaultBalance.add(expectedProfit);

    const newVaultBalance = await alice.vault.getBalance(alice.address);

    expect(expectedNewVaultBalance).to.equal(newVaultBalance);
  });

  //TODO: add tests to assert the impact of the funding rate on the profit
});

// TEST CHECKING EXCHANGE RATES KEPT FOR REFERENCE
//
// it('No exchange rate applied for SHORT positions', async () => {
//   // set-up
//   await setUpPoolLiquidity(bob, depositAmountUSDC.div(2));
//   await alice.perpetual.deposit(depositAmountUSDC, alice.usdc.address);

//   const vBaseLiquidityBeforePositionCreated = await alice.market.balances(
//     VBASE_INDEX
//   );

//   await alice.perpetual.openPosition(depositAmount.div(10), Side.Short);

//   const vBaseLiquidityAfterPositionCreated = await alice.market.balances(
//     VBASE_INDEX
//   );
//   const alicePositionNotional = (
//     await alice.perpetual.getTraderPosition(alice.address)
//   ).openNotional;

//   // verify that EUR_USD exchange rate is applied to positionNotionalAmount
//   // vBaseLiquidityAfterPositionCreated = vBaseLiquidityBeforePositionCreated - rDiv(positionNotionalAmount, EUR_USD)

//   const positionNotionalAmount = await tokenToWad(
//     await alice.vault.getReserveTokenDecimals(),
//     aliceUSDCAmount
//   );
//   // const alicePositionInEuro = rDiv(positionNotionalAmount, EUR_USD);
//   // const expectedVBaseLiquidityAfterPositionCreated =
//   //   vBaseLiquidityBeforePositionCreated.add(alicePositionInEuro);

//   // expect(vBaseLiquidityAfterPositionCreated).to.equal(
//   //   expectedVBaseLiquidityAfterPositionCreated
//   // );

//   await alice.perpetual.closePosition(
//     (
//       await alice.perpetual.getTraderPosition(alice.address)
//     ).positionSize
//   );

//   const vBaseLiquidityAfterPositionClosed = await alice.market.balances(
//     VBASE_INDEX
//   );

//   // // expectedVBaseReceived = rMul((user.profit + user.openNotional), EUR_USD)
//   // const alicePositionProfit = (
//   //   await alice.perpetual.getTraderPosition(alice.address)
//   // ).profit;
//   // const expectedVQuoteProceeds = alicePositionProfit.add(
//   //   alicePositionNotional
//   // );
//   // const expectedVBaseReceived = rDiv(expectedVQuoteProceeds, EUR_USD);

//   // // expectedVBaseReceived = vBaseLiquidityAfterPositionCreated - vBaseLiquidityAfterPositionClosed
//   // const vBaseLiquidityDiff = vBaseLiquidityAfterPositionCreated.sub(
//   //   vBaseLiquidityAfterPositionClosed
//   // );

//   // // there's a difference of 1 wei between the 2 values
//   // // vBaseLiquidityDiff: 8796304059175223295
//   // // expectedVBaseReceived: 8796304059175223294
//   // // probably a rounding error in `rDiv`
//   // expect(vBaseLiquidityDiff).to.be.closeTo(expectedVBaseReceived, 1);
// });
