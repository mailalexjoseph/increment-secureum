import {expect} from 'chai';
import {utils, BigNumber} from 'ethers';
import env, {ethers} from 'hardhat';

import {rMul, rDiv} from '../helpers/utils/calculations';
import {setup, funding, User} from '../helpers/setup';
import {setUpPoolLiquidity} from '../helpers/PerpetualUtils';
import {setNextBlockTimestamp} from '../../helpers/misc-utils';
import {getBlockTime, tokenToWad} from '../../helpers/contracts-helpers';
import {Side} from '../helpers/utils/types';

/*
 * Test liquidation on the main contract.
 *
 * Note: generating successful liquidations because of insufficient `collateral` or `unrealizedPositionPnl`
 * is very hard to do without mocking the Vault and the PoolTWAPOracle contracts.
 * As a result, liquidations are only done using unfavorable funding payments.
 */
describe('Increment: liquidation', () => {
  let alice: User;
  let bob: User;
  let depositAmountUSDC: BigNumber;
  let depositAmount: BigNumber; // with 1e18 decimals
  let aliceUSDCAmount: BigNumber;
  let aliceAmount: BigNumber;

  // protocol constants
  let MIN_MARGIN: BigNumber;
  let LIQUIDATION_REWARD: BigNumber;
  let TWAP_FREQUENCY: BigNumber;
  let FEE: BigNumber;
  let MIN_MARGIN_AT_CREATION: BigNumber;
  let VQUOTE_INDEX: BigNumber;
  let VBASE_INDEX: BigNumber;

  before('Get protocol constants', async () => {
    ({alice, bob} = await setup());

    MIN_MARGIN = await alice.perpetual.MIN_MARGIN();
    LIQUIDATION_REWARD = await alice.perpetual.LIQUIDATION_REWARD();
    TWAP_FREQUENCY = await alice.perpetual.TWAP_FREQUENCY();
    FEE = await alice.perpetual.FEE();
    MIN_MARGIN_AT_CREATION = await alice.perpetual.MIN_MARGIN_AT_CREATION();
    VQUOTE_INDEX = await alice.perpetual.VQUOTE_INDEX();
    VBASE_INDEX = await alice.perpetual.VBASE_INDEX();
  });

  beforeEach(
    'Give Alice funds and approve transfer by the vault to her balance',
    async () => {
      ({alice, bob} = await setup());
      depositAmountUSDC = await funding(); // amount used for collaterals and liquidity provisioning
      aliceUSDCAmount = depositAmountUSDC.div(10); // Alice deposits and exchanges 10% of the pool liquidity
      depositAmount = await tokenToWad(
        await alice.vault.getReserveTokenDecimals(),
        depositAmountUSDC
      );
      aliceAmount = depositAmount.div(10);

      // bob deposits liquidity, alice opens a position of half this liquidity
      await setUpPoolLiquidity(bob, depositAmountUSDC);
      await alice.usdc.approve(alice.vault.address, aliceUSDCAmount);
      await alice.perpetual.deposit(aliceUSDCAmount, alice.usdc.address);
    }
  );

  it('Should fail if liquidator tries to liquidate a position of a user having no position', async () => {
    await expect(
      bob.perpetual.liquidate(alice.address, depositAmount)
    ).to.be.revertedWith('No position currently opened');
  });

  it('Should fail if user has enough margin', async () => {
    await alice.perpetual.openPosition(aliceAmount, Side.Long);

    await expect(
      bob.perpetual.liquidate(alice.address, depositAmount)
    ).to.be.revertedWith('Margin is valid');
  });

  it('Should liquidate LONG position out-of-the-money', async () => {
    await alice.perpetual.openPosition(aliceAmount, Side.Long);

    const aliceVaultBalanceBeforeClosingPosition = await alice.vault.getBalance(
      alice.address
    );
    const bobVaultBalanceBeforeLiquidation = await bob.vault.getBalance(
      bob.address
    );

    // make the funding rate negative so that the Alice's position drops below MIN_MARGIN
    const timestampForkedMainnetBlock = 1639682285;
    const timestampJustBefore = timestampForkedMainnetBlock - 15;
    await bob.perpetual.__TestPerpetual_setGlobalPosition(
      0,
      timestampJustBefore,
      0,
      utils.parseEther('10000') // set very large cumFundingRate so that the position ends up below MIN_MARGIN
    );

    // Check `LiquidationCall` event sent with proper values
    // Note: the value of the timestamp at which the liquidation is performed can't be predicted reliably
    // so we don't check the values of the arguments of the event
    await expect(bob.perpetual.liquidate(alice.address, 0)).to.emit(
      alice.perpetual,
      'LiquidationCall'
    );

    // Check trader's position is closed, i.e. user.openNotional and user.positionSize = 0
    const alicePosition = await alice.perpetual.getTraderPosition(
      alice.address
    );
    expect(alicePosition.openNotional).to.eq(0);
    expect(alicePosition.positionSize).to.eq(0);

    // Check trader's vault.balance is reduced by negative profit and liquidation fee
    const aliceVaultBalanceAfterClosingPosition = await alice.vault.getBalance(
      alice.address
    );
    expect(aliceVaultBalanceAfterClosingPosition).to.be.lt(
      aliceVaultBalanceBeforeClosingPosition
    );

    // Check liquidator's vault.balance is increased by the liquidation reward
    const liquidationReward = rMul(aliceAmount, LIQUIDATION_REWARD);
    const bobVaultBalanceAfterLiquidation = await bob.vault.getBalance(
      bob.address
    );
    expect(bobVaultBalanceAfterLiquidation).to.eq(
      bobVaultBalanceBeforeLiquidation.add(liquidationReward)
    );
  });

  it('Should fail to liquidate SHORT position out-of-the-money if excessive tentativeVQuoteAmount is submitted by liquidator', async () => {
    await alice.perpetual.openPosition(aliceAmount, Side.Short);

    // make the funding rate negative so that the Alice's position drops below MIN_MARGIN
    const timestampForkedMainnetBlock = 1639682285;
    const timestampJustBefore = timestampForkedMainnetBlock - 15;
    await bob.perpetual.__TestPerpetual_setGlobalPosition(
      0,
      timestampJustBefore,
      0,
      utils.parseEther('10000').mul(-1) // set very large negative cumFundingRate so that the position ends up below MIN_MARGIN
    );

    const excessiveTentativeVQuoteAmount = aliceAmount.mul(10);
    await expect(
      bob.perpetual.liquidate(alice.address, excessiveTentativeVQuoteAmount)
    ).to.be.revertedWith(
      'Amount submitted too far from the market price of the position'
    );
  });

  it('Should fail if the proposed tentativeVQuoteAmount is insufficient to buy back a SHORT position', async () => {
    await alice.perpetual.openPosition(aliceAmount, Side.Short);

    // make the funding rate negative so that the Alice's position drops below MIN_MARGIN
    const timestampForkedMainnetBlock = 1639682285;
    const timestampJustBefore = timestampForkedMainnetBlock - 15;
    await bob.perpetual.__TestPerpetual_setGlobalPosition(
      0,
      timestampJustBefore,
      0,
      utils.parseEther('10000').mul(-1) // set very large negative cumFundingRate so that the position ends up below MIN_MARGIN
    );

    const insufficientVQuoteAmountToBuyVBaseShort = aliceAmount;
    await expect(
      bob.perpetual.liquidate(
        alice.address,
        insufficientVQuoteAmountToBuyVBaseShort
      )
    ).to.be.revertedWith('Not enough returned, proposed amount too low');
  });

  it('Should liquidate SHORT position out-of-the-money', async () => {
    await alice.perpetual.openPosition(aliceAmount, Side.Short);
    const positionOpenNotional = (
      await alice.perpetual.getTraderPosition(alice.address)
    ).openNotional;

    const aliceVaultBalanceBeforeClosingPosition = await alice.vault.getBalance(
      alice.address
    );
    const bobVaultBalanceBeforeLiquidation = await bob.vault.getBalance(
      bob.address
    );

    // make the funding rate negative so that the Alice's position drops below MIN_MARGIN
    //const timestampForkedMainnetBlock = await getBlockTime();
    const timestampForkedMainnetBlock = 1639682285;
    const timestampJustBefore = timestampForkedMainnetBlock - 15;
    await bob.perpetual.__TestPerpetual_setGlobalPosition(
      0,
      timestampJustBefore,
      0,
      utils.parseEther('10000').mul(-1) // set very large negative cumFundingRate so that the position ends up below MIN_MARGIN
    );

    // Check `LiquidationCall` event sent with proper values
    // Note: the value of the timestamp at which the liquidation is performed can't be predicted reliably
    // so we don't check the values of the arguments of the event
    const properVQuoteAmountToBuyBackShortPosition = aliceAmount.add(
      aliceAmount.div(4)
    );
    await expect(
      bob.perpetual.liquidate(
        alice.address,
        properVQuoteAmountToBuyBackShortPosition
      )
    ).to.emit(alice.perpetual, 'LiquidationCall');

    // Check trader's position is closed, i.e. user.openNotional and user.positionSize = 0
    const alicePosition = await alice.perpetual.getTraderPosition(
      alice.address
    );
    expect(alicePosition.openNotional).to.eq(0);
    expect(alicePosition.positionSize).to.eq(0);

    // Check trader's vault.balance is reduced by negative profit and liquidation fee
    const aliceVaultBalanceAfterClosingPosition = await alice.vault.getBalance(
      alice.address
    );
    expect(aliceVaultBalanceAfterClosingPosition).to.be.lt(
      aliceVaultBalanceBeforeClosingPosition
    );

    // Check liquidator's vault.balance is increased by the liquidation reward
    const liquidationReward = rMul(positionOpenNotional, LIQUIDATION_REWARD);
    const bobVaultBalanceAfterLiquidation = await bob.vault.getBalance(
      bob.address
    );

    // closeTo is used to avoid error of 1 wei here
    expect(bobVaultBalanceAfterLiquidation).to.be.closeTo(
      bobVaultBalanceBeforeLiquidation.add(liquidationReward),
      1
    );
  });
});
