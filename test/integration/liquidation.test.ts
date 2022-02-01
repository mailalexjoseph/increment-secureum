import {expect} from 'chai';
import {utils, BigNumber} from 'ethers';
import env from 'hardhat';

import {rMul, rDiv} from '../helpers/calculations';
import {setup, funding, User} from './helpers/setup';
import {setUpPoolLiquidity} from './helpers/PerpetualUtils';
import {setNextBlockTimestamp} from '../../helpers/misc-utils';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {Side} from './helpers/utils/types';

describe('Increment: liquidation', () => {
  let alice: User;
  let bob: User;
  let aliceDepositAmount: BigNumber;

  // protocol constants
  let MIN_MARGIN: BigNumber;
  let LIQUIDATION_FEE: BigNumber;
  let TWAP_FREQUENCY: BigNumber;
  let FEE: BigNumber;
  let MIN_MARGIN_AT_CREATION: BigNumber;
  let VQUOTE_INDEX: BigNumber;
  let VBASE_INDEX: BigNumber;

  before('Get protocol constants', async () => {
    ({alice, bob} = await setup());

    MIN_MARGIN = await alice.perpetual.MIN_MARGIN();
    LIQUIDATION_FEE = await alice.perpetual.LIQUIDATION_FEE();
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
      const depositAmount = await funding();

      // bob deposits liquidity, alice opens a position of half this liquidity
      await setUpPoolLiquidity(bob, depositAmount);
      aliceDepositAmount = depositAmount.div(2);
      await alice.usdc.approve(alice.vault.address, aliceDepositAmount);
      await alice.perpetual.deposit(aliceDepositAmount, alice.usdc.address);
      await alice.perpetual.openPosition(aliceDepositAmount, Side.Long);
    }
  );

  it('Should fail if user has enough margin', async () => {
    await expect(bob.perpetual.liquidate(alice.address)).to.be.revertedWith(
      'Margin is valid'
    );
  });

  it('Should liquidate the position', async () => {
    const timestampForkedMainnetBlock = 1639682285;
    const notionalAmount = await tokenToWad(
      await alice.vault.getReserveTokenDecimals(),
      aliceDepositAmount
    );

    const aliceVaultBalanceBeforeClosingPosition = await alice.vault.getBalance(
      alice.address
    );
    const bobVaultBalanceBeforeLiquidation = await bob.vault.getBalance(
      bob.address
    );

    // make the funding rate negative so that the Alice's position drops below MIN_MARGIN
    const timestampJustBefore = timestampForkedMainnetBlock - 15;
    await bob.perpetual.setGlobalPosition(
      0,
      timestampJustBefore,
      timestampJustBefore,
      0,
      utils.parseEther('10000').mul(-1) // set very large negative cumFundingRate so that the position is below MIN_MARGIN
    );

    // Check `LiquidationCall` event sent with proper values
    // Note: the value of the timestamp at which the liquidation is performed can't be predicted reliably
    // because this value changes from one machine to another (e.g. CI vs local machine).
    await expect(bob.perpetual.liquidate(alice.address)).to.emit(
      alice.perpetual,
      'LiquidationCall'
    );

    // Check trader's position is closed, i.e. user.notional and user.positionSize = 0
    const alicePosition = await alice.perpetual.getUserPosition(alice.address);
    expect(alicePosition.notional).to.eq(0);
    expect(alicePosition.positionSize).to.eq(0);

    // Check trader's vault.balance is reduced by negative profit and liquidation fee
    const aliceVaultBalanceAfterClosingPosition = await alice.vault.getBalance(
      alice.address
    );
    expect(aliceVaultBalanceAfterClosingPosition).to.be.lt(
      aliceVaultBalanceBeforeClosingPosition
    );

    // Check liquidator's vault.balance is increase by the liquidation fee
    const liquidationFee = rMul(notionalAmount, LIQUIDATION_FEE);
    const bobVaultBalanceAfterLiquidation = await bob.vault.getBalance(
      bob.address
    );
    expect(bobVaultBalanceAfterLiquidation).to.eq(
      bobVaultBalanceBeforeLiquidation.add(liquidationFee)
    );
  });

  // Possible improvements: add a success case of liquidation because of a negative unrealizedPositionPnl
});
