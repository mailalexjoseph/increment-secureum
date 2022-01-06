import chaiModule = require('../chai-setup');
const {expect} = chaiModule;

import {utils, BigNumber} from 'ethers';
import env from 'hardhat';

import {rMul, rDiv} from './helpers/utils/calculations';
import {setup, funding, User} from './helpers/setup';
import {setUpPoolLiquidity} from './helpers/PerpetualUtils';
import {setNextBlockTimestamp} from '../../helpers/misc-utils';
import {Side} from './helpers/utils/types';

/*
 * To avoid significant hurdle in instanting all the dependencies of Perpetual (oracle, etc)
 * including the curve pool, Perpetual tests are run in the context of a mainnet fork.
 *
 * The contract used for test with not Perpetual but TestPerpetual. The difference between the
 * two is that TestPerpetual includes some setter functions to edit part of the internal
 * state of Perpetual which isn't exposed otherwise.
 */
describe('Perpetual', () => {
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

  before('Get protocol constants', async () => {
    ({alice, bob} = await setup());

    MIN_MARGIN = await alice.perpetual.MIN_MARGIN();
    LIQUIDATION_FEE = await alice.perpetual.LIQUIDATION_FEE();
    PRECISION = await alice.perpetual.PRECISION();
    TWAP_FREQUENCY = await alice.perpetual.TWAP_FREQUENCY();
    FEE = await alice.perpetual.FEE();
    MIN_MARGIN_AT_CREATION = await alice.perpetual.MIN_MARGIN_AT_CREATION();
  });

  beforeEach(
    'Give Alice funds and approve transfer by the vault to her balance',
    async () => {
      ({alice} = await setup());
      depositAmount = await funding();

      await alice.usdc.approve(alice.vault.address, depositAmount);
    }
  );

  describe('Open trader position', () => {
    it('Should fail if the pool has no liquidity in it', async () => {
      await alice.perpetual.deposit(depositAmount.div(2), alice.usdc.address);
      // no error message as the code fails with the pool
      await expect(
        alice.perpetual.openPosition(depositAmount.div(2), Side.Long)
      ).to.be.reverted;
    });

    it('Should fail if the amount is null', async () => {
      await expect(
        alice.perpetual.openPosition(0, Side.Long)
      ).to.be.revertedWith("The amount can't be null");
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

    it('Should open long position (swap some minted vQuote for vBase, create TraderPosition, emit OpenPosition)', async () => {
      // set-up
      await setUpPoolLiquidity(bob, depositAmount);
      await alice.perpetual.deposit(depositAmount.div(2), alice.usdc.address);

      // expected values
      const nextBlockTimestamp = await setNextBlockTimestamp(env);
      const expectedQuoteBought = '44166136';
      const positionNotionalAmount = depositAmount.div(2).toString();

      await expect(
        alice.perpetual.openPosition(depositAmount.div(2), Side.Long)
      )
        .to.emit(alice.perpetual, 'OpenPosition')
        .withArgs(
          alice.address,
          nextBlockTimestamp,
          Side.Long,
          positionNotionalAmount,
          expectedQuoteBought // might break if parameters of Perpetual are changed
        );

      const alicePosition = await alice.perpetual.getUserPosition(
        alice.address
      );
      expect(alicePosition.positionSize.toString()).to.equal(
        expectedQuoteBought
      );
      expect(alicePosition.notional.toString()).to.equal(
        positionNotionalAmount
      );
      expect(alicePosition.profit.toNumber()).to.equal(0);
      expect(alicePosition.side).to.equal(Side.Long);
      expect(alicePosition.timeStamp.toNumber()).to.equal(nextBlockTimestamp);
      // cumFundingRate is set at 0 because there's no activity before in this test
      expect(alicePosition.cumFundingRate.toNumber()).to.equal(0);
    });

    // it('Should open short position (swap some minted vBase for vQuote, create TraderPosition, emit OpenPosition)', async () => {});
  });
});
