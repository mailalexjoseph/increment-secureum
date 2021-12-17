import chaiModule = require('../chai-setup');
const {expect} = chaiModule;

import {utils, BigNumber} from 'ethers';
import {rMul, rDiv} from './helpers/utils/calculations';

import {setup, funding, User} from './helpers/setup';
import {
  setUpPoolLiquidity,
  setNextBlockTimestamp,
} from './helpers/PerpetualUtils';

const enum Side {
  Long,
  Short,
}

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
    it('Should fail if the amount is null', async () => {
      await expect(
        alice.perpetual.openPosition(0, Side.Long)
      ).to.be.revertedWith("The amount can't be null");
    });

    // it('Should fail if user already has an open position on this market', async () => {
    //   await alice.perpetual.deposit(depositAmount, alice.usdc.address);

    //   await alice.perpetual.__testOnly_setUserTraderPositionNotional(
    //     alice.address,
    //     depositAmount
    //   );

    //   // create a trader position for Alice, well with margin requirements
    //   await expect(
    //     alice.perpetual.openPosition(depositAmount, Side.Long)
    //   ).to.be.revertedWith(
    //     'Trader position is not allowed to have a position already open'
    //   );
    // });

    it('Should fail if user does not have enough funds deposited in the vault', async () => {
      await alice.perpetual.deposit(depositAmount, alice.usdc.address);

      const depositedAmount = await alice.vault.getReserveValue(alice.address);

      // get the position amount matching the exact limit of MIN_MARGIN_AT_CREATION
      const limitAmount = rDiv(depositedAmount, MIN_MARGIN_AT_CREATION);
      // add 1 to it to exceed the margin limit
      const exceedingAmount = limitAmount.add(1);

      await expect(
        alice.perpetual.openPosition(exceedingAmount, Side.Long)
      ).to.be.revertedWith('Not enough funds in the vault for this position');
    });

    // note: add a test to check what happens if we try to do an exchange while the pool is empty :p

    it('Should open long position (swap some minted vQuote for vBase, create TraderPosition, emit OpenPosition)', async () => {
      // set-up
      await setUpPoolLiquidity(bob, depositAmount);
      // console.log('balance(0)');
      // console.log((await alice.market.balances(0)).toString());
      // console.log('balance(1)');
      // console.log((await alice.market.balances(1)).toString());
      // const expectedQuoteBought = await alice.market.get_dy(1, 0, 0);

      // flow
      await alice.perpetual.deposit(depositAmount.div(2), alice.usdc.address);
      const nextBlockTimestamp = await setNextBlockTimestamp();
      await expect(
        alice.perpetual.openPosition(depositAmount.div(2), Side.Long)
      )
        .to.emit(alice.perpetual, 'OpenPosition')
        .withArgs(
          alice.address,
          nextBlockTimestamp,
          Side.Long,
          depositAmount.div(2),
          99560
        );
    });

    it('Should open short position (swap some minted vBase for vQuote, create TraderPosition, emit OpenPosition)', async () => {});
  });
});
