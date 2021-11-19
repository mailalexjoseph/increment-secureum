import {expect} from 'chai';
import {setup, funding} from './helpers/setup';
import {convertToCurrencyUnits} from '../helpers/contracts-helpers';
import {utils, BigNumber} from 'ethers';
import {Perpetual, Vault, ERC20} from '../typechain';

describe('Increment App: Reserve', function () {
  let user: any, deployer: any;
  let perpetual: Perpetual, vault: Vault, usdc: ERC20;
  let depositAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({user, deployer, perpetual, vault, usdc} = await setup());
    depositAmount = await funding();
    await user.usdc.approve(vault.address, depositAmount);
    await deployer.perpetual.setVault(vault.address);
  });
  describe('Can deposit and withdraw USDC', function () {
    it('Should have enough cash and allowances', async function () {
      // should have enough balance to deposit
      expect(depositAmount).to.be.above(0);
      expect(await user.usdc.balanceOf(user.address)).to.be.equal(
        depositAmount
      );
      // should succesfully approve
      expect(await usdc.allowance(user.address, vault.address)).to.be.equal(
        depositAmount
      );
    });

    it('Can deposit USDC into verified vault', async function () {
      // depositing should fire up deposit event
      await expect(
        user.perpetual.deposit(depositAmount, vault.address, usdc.address)
      )
        .to.emit(perpetual, 'Deposit')
        .withArgs(user.address, usdc.address, depositAmount);

      // should have correct balance in vault
      expect(await user.usdc.balanceOf(user.address)).to.be.equal(0);
      expect(await usdc.balanceOf(vault.address)).to.be.equal(depositAmount);
      expect(await usdc.balanceOf(user.address)).to.be.equal(0);

      //should notice deposited amount in asset value / portfolio value
      expect(
        utils.formatEther(await vault.getReserveValue(user.address))
      ).to.be.equal(await convertToCurrencyUnits(usdc, depositAmount));
    });
    it('Can not deposit USDC into unknown vault', async function () {
      const unknownVault = '0x0000000000000000000000000000000000000000';
      await expect(
        user.perpetual.deposit(depositAmount, unknownVault, usdc.address)
      ).to.revertedWith('Vault is not initialized');
    });
    it('Should withdraw USDC', async function () {
      // deposit
      await user.perpetual.deposit(depositAmount, vault.address, usdc.address);
      const userDeposits = await user.vault.getReserveValue(user.address);

      // withdrawal should fire up withdrawal event
      await expect(user.perpetual.withdraw(userDeposits, usdc.address))
        .to.emit(perpetual, 'Withdraw')
        .withArgs(user.address, usdc.address, userDeposits);

      // balance should be same as before withdrawal
      expect(await usdc.balanceOf(user.address)).to.be.equal(depositAmount);
    });
    it('Should not withdraw more USDC then deposited', async function () {
      // deposit
      await user.perpetual.deposit(depositAmount, vault.address, usdc.address);
      const userDeposits = await user.vault.getReserveValue(user.address);
      const tooLargeWithdrawal = userDeposits.add(1);

      // should not be able to withdraw more than deposited
      await expect(
        user.perpetual.withdraw(tooLargeWithdrawal, usdc.address)
      ).to.be.revertedWith('Not enough balance');
    });
    it('Should not withdraw other token then deposited', async function () {
      // deposit
      await user.perpetual.deposit(depositAmount, vault.address, usdc.address);
      const userDeposits = await user.vault.getReserveValue(user.address);

      // should not be able to withdraw other token then deposited
      const wrongToken = '0x99d8a9c45b2eca8864373a26d1459e3dff1e17f3';
      await expect(
        user.perpetual.withdraw(userDeposits, wrongToken)
      ).to.be.revertedWith('Wrong token address');
    });
    it('User should not be able to access vault directly', async function () {
      await expect(
        user.vault.deposit(user.address, depositAmount, usdc.address)
      ).to.be.revertedWith('Only Perpetual can call this function');
      await expect(
        user.vault.withdraw(user.address, depositAmount, usdc.address)
      ).to.be.revertedWith('Only Perpetual can call this function');
      await expect(user.vault.settleProfit(user.address, 0)).to.be.revertedWith(
        'Only Perpetual can call this function'
      );
    });
  });
});
