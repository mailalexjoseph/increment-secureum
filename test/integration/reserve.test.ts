import {expect} from 'chai';
import {utils, BigNumber} from 'ethers';

import {setup, funding, User} from '../helpers/setup';
import {
  convertToCurrencyUnits,
  wadToToken,
} from '../../helpers/contracts-helpers';
import {asBigNumber} from '../helpers/utils/calculations';

describe('Increment App: Reserve', function () {
  let user: User, deployer: User;
  let depositAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({user, deployer} = await setup());
    depositAmount = await funding();
    await user.usdc.approve(user.vault.address, depositAmount);
  });

  describe('Can deposit and withdraw USDC', function () {
    it('Should have enough cash and allowances', async function () {
      // should have enough balance to deposit
      expect(depositAmount).to.be.above(0);
      expect(await user.usdc.balanceOf(user.address)).to.be.equal(
        depositAmount
      );
      // should successfully approve
      expect(
        await user.usdc.allowance(user.address, user.vault.address)
      ).to.be.equal(depositAmount);
    });

    it('Can deposit USDC into the vault', async function () {
      // depositing should fire up deposit event
      await expect(
        user.clearingHouse.deposit(0, depositAmount, user.usdc.address, false)
      )
        .to.emit(user.clearingHouse, 'Deposit')
        .withArgs(0, user.address, user.usdc.address, depositAmount);

      // should have correct balance in vault
      expect(await user.usdc.balanceOf(user.address)).to.be.equal(0);
      expect(await user.usdc.balanceOf(user.vault.address)).to.be.equal(
        depositAmount
      );

      // should notice deposited amount in asset value / portfolio value
      expect(
        utils.formatEther(await user.vault.getLpReserveValue(0, user.address))
      ).to.be.equal(await convertToCurrencyUnits(user.usdc, depositAmount));
    });

    it('Should withdraw USDC', async function () {
      // deposit
      await user.clearingHouse.deposit(
        0,
        depositAmount,
        user.usdc.address,
        false
      );
      const userDeposits = await user.vault.getLpReserveValue(0, user.address);

      // withdrawal should fire up withdrawal event
      await expect(
        user.clearingHouse.withdraw(0, userDeposits, user.usdc.address, false)
      )
        .to.emit(user.clearingHouse, 'Withdraw')
        .withArgs(0, user.address, user.usdc.address, userDeposits);

      // balance should be same as before withdrawal
      expect(await user.usdc.balanceOf(user.address)).to.be.equal(
        depositAmount
      );
      expect(await user.vault.getLpReserveValue(0, user.address)).to.be.equal(
        0
      );
    });

    it('Should not withdraw more USDC then deposited', async function () {
      // deposit
      await user.clearingHouse.deposit(
        0,
        depositAmount,
        user.usdc.address,
        false
      );
      const userDeposits = await user.vault.getLpReserveValue(0, user.address);
      const tooLargeWithdrawal = userDeposits.add(1);

      // should not be able to withdraw more than deposited
      await expect(
        user.clearingHouse.withdraw(
          0,
          tooLargeWithdrawal,
          user.usdc.address,
          false
        )
      ).to.be.revertedWith('Not enough balance');
    });

    it('Should not withdraw other token then deposited', async function () {
      // deposit
      await user.clearingHouse.deposit(
        0,
        depositAmount,
        user.usdc.address,
        false
      );
      const userDeposits = await user.vault.getLpReserveValue(0, user.address);

      // should not be able to withdraw other token then deposited
      const wrongToken = '0x99d8a9c45b2eca8864373a26d1459e3dff1e17f3';
      await expect(
        user.clearingHouse.withdraw(0, userDeposits, wrongToken, false)
      ).to.be.revertedWith('Wrong token address');
    });

    it('User should not be able to access vault directly', async function () {
      await expect(
        user.vault.deposit(
          0,
          user.address,
          depositAmount,
          user.usdc.address,
          false
        )
      ).to.be.revertedWith('NO CLEARINGHOUSE');

      await expect(
        user.vault.withdraw(
          0,
          user.address,
          depositAmount,
          user.usdc.address,
          false
        )
      ).to.be.revertedWith('NO CLEARINGHOUSE');

      await expect(
        user.vault.settleProfit(0, user.address, 0, false)
      ).to.be.revertedWith('NO CLEARINGHOUSE');
    });

    it('User can not deposit once limit is reached', async function () {
      // set new limit
      const newMaxTVL = asBigNumber('100');
      await deployer.vault.setMaxTVL(newMaxTVL);

      const maxDeposit = await wadToToken(
        await user.usdc.decimals(),
        newMaxTVL
      );
      await expect(
        user.clearingHouse.deposit(
          0,
          maxDeposit.add(1),
          user.usdc.address,
          false
        )
      ).to.be.revertedWith('MAX_TVL');
    });
  });
});
