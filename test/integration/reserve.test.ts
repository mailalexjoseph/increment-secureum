import {expect} from 'chai';
import {utils, BigNumber} from 'ethers';

import {setup, funding, User} from './helpers/setup';
import {convertToCurrencyUnits} from '../../helpers/contracts-helpers';

describe('Increment App: Reserve', function () {
  let user: User;
  let depositAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({user} = await setup());
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
      // should succesfully approve
      expect(
        await user.usdc.allowance(user.address, user.vault.address)
      ).to.be.equal(depositAmount);
    });

    it('Can deposit USDC into the vault', async function () {
      // depositing should fire up deposit event
      await expect(user.perpetual.deposit(depositAmount, user.usdc.address))
        .to.emit(user.perpetual, 'Deposit')
        .withArgs(user.address, user.usdc.address, depositAmount);

      // should have correct balance in vault
      expect(await user.usdc.balanceOf(user.address)).to.be.equal(0);
      expect(await user.usdc.balanceOf(user.vault.address)).to.be.equal(
        depositAmount
      );

      // should notice deposited amount in asset value / portfolio value
      expect(
        utils.formatEther(await user.vault.getReserveValue(user.address))
      ).to.be.equal(await convertToCurrencyUnits(user.usdc, depositAmount));
    });
  });

  it('Should withdraw USDC', async function () {
    // deposit
    await user.perpetual.deposit(depositAmount, user.usdc.address);
    const userDeposits = await user.vault.getReserveValue(user.address);

    // withdrawal should fire up withdrawal event
    await expect(user.perpetual.withdraw(userDeposits, user.usdc.address))
      .to.emit(user.perpetual, 'Withdraw')
      .withArgs(user.address, user.usdc.address, userDeposits);

    // balance should be same as before withdrawal
    expect(await user.usdc.balanceOf(user.address)).to.be.equal(depositAmount);
  });

  it('Should not withdraw more USDC then deposited', async function () {
    // deposit
    await user.perpetual.deposit(depositAmount, user.usdc.address);
    const userDeposits = await user.vault.getReserveValue(user.address);
    const tooLargeWithdrawal = userDeposits.add(1);

    // should not be able to withdraw more than deposited
    await expect(
      user.perpetual.withdraw(tooLargeWithdrawal, user.usdc.address)
    ).to.be.revertedWith('Not enough balance');
  });

  it('Should not withdraw other token then deposited', async function () {
    // deposit
    await user.perpetual.deposit(depositAmount, user.usdc.address);
    const userDeposits = await user.vault.getReserveValue(user.address);

    // should not be able to withdraw other token then deposited
    const wrongToken = '0x99d8a9c45b2eca8864373a26d1459e3dff1e17f3';
    await expect(
      user.perpetual.withdraw(userDeposits, wrongToken)
    ).to.be.revertedWith('Wrong token address');
  });

  it('User should not be able to access vault directly', async function () {
    await expect(
      user.vault.deposit(user.address, depositAmount, user.usdc.address)
    ).to.be.revertedWith('NOT_OWNER');

    await expect(
      user.vault.withdraw(user.address, depositAmount, user.usdc.address)
    ).to.be.revertedWith('NOT_OWNER');

    await expect(user.vault.settleProfit(user.address, 0)).to.be.revertedWith(
      'NOT_OWNER'
    );
  });
});
