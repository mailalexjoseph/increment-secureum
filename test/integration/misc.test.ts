import {expect} from 'chai';
import {BigNumber} from 'ethers';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {
  extendPositionWithCollateral,
  setUpPoolLiquidity,
} from '../helpers/PerpetualUtils';

import {setup, funding, User} from '../helpers/setup';
import {Side} from '../helpers/utils/types';

describe('Increment App: ClearingHouseViewer', function () {
  let trader: User, lp: User;
  let depositAmountUSDC: BigNumber, depositAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({lp, trader} = await setup());
    depositAmountUSDC = await funding();
    depositAmount = await tokenToWad(
      await trader.vault.getReserveTokenDecimals(),
      depositAmountUSDC
    );
    await setUpPoolLiquidity(lp, depositAmountUSDC);
  });

  describe('Market', function () {
    it('Can call getProposedAmount for long position', async function () {
      // should have enough balance to deposit
      await extendPositionWithCollateral(
        trader,
        trader.usdc,
        depositAmount.div(100),
        depositAmount.div(100),
        Side.Long
      );

      const proposedAmount = await trader.clearingHouseViewer.getProposedAmount(
        0,
        trader.address,
        5
      );

      await trader.clearingHouse.reducePosition(0, proposedAmount.amountIn, 0);

      expect(
        (await trader.perpetual.getTraderPosition(trader.address)).positionSize
      ).to.be.eq(0);
    });
    it('Can call getProposedAmount for short position', async function () {
      // should have enough balance to deposit
      await extendPositionWithCollateral(
        trader,
        trader.usdc,
        depositAmount.div(100),
        depositAmount.div(100),
        Side.Short
      );

      const proposedAmount = await trader.clearingHouseViewer.getProposedAmount(
        0,
        trader.address,
        5
      );

      await trader.clearingHouse.reducePosition(0, proposedAmount.amountIn, 0);

      expect(
        (await trader.perpetual.getTraderPosition(trader.address)).positionSize
      ).to.be.eq(0);
    });
  });
});
