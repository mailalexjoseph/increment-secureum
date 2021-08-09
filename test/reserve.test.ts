import {expect} from 'chai';
import {setup, funding} from './helpers/setup';
import {
  convertToCurrencyDecimals,
  convertToCurrencyUnits,
} from '../helpers/contracts-helpers';
import {utils, BigNumber} from 'ethers';

describe('Increment App: Reserve', function () {
  describe('Can deposit and withdraw USDC', function () {
    it('Should give allowance to contracts.perpetual contract', async function () {
      const {deployer, perpetual, usdc} = await setup();
      const depositAmount = await funding();

      // should have enough balance to deposit
      expect(await deployer.usdc.balanceOf(deployer.address)).to.be.equal(
        depositAmount
      );

      // should succesfully approve
      await deployer.usdc.approve(perpetual.address, depositAmount);
      const allowance = await usdc.allowance(
        deployer.address,
        perpetual.address
      );
      expect(allowance).to.be.equal(depositAmount);
    });

    it('Should deposit USDC', async function () {
      const {deployer, perpetual, usdc} = await setup();
      const depositAmount = await funding();

      await deployer.usdc.approve(perpetual.address, depositAmount);

      // should fire up deposit event
      await expect(deployer.perpetual.deposit(depositAmount, usdc.address))
        .to.emit(perpetual, 'Deposit')
        .withArgs(depositAmount, deployer.address, usdc.address);

      // should notice deposited amount in asset value / portfolio value
      expect(
        utils.formatEther(
          await perpetual.getAssetValue(deployer.address, usdc.address)
        )
      ).to.be.equal(await convertToCurrencyUnits(usdc, depositAmount));

      expect(
        utils.formatEther(await perpetual.getPortfolioValue(deployer.address))
      ).to.be.equal(await convertToCurrencyUnits(usdc, depositAmount));
    });
    it('Should withdraw USDC', async function () {
      const {deployer, perpetual, usdc} = await setup();
      const depositAmount = await funding();

      await deployer.usdc.approve(perpetual.address, depositAmount);
      await deployer.perpetual.deposit(depositAmount, usdc.address);

      // withdrawable amount is equal to amount deposited
      const deployerBalance: BigNumber =
        await deployer.perpetual.getReserveBalance(
          deployer.address,
          usdc.address
        );
      const deposited = await convertToCurrencyUnits(usdc, depositAmount);
      expect(utils.formatEther(deployerBalance)).to.be.equal(deposited);

      // should fire up withdrawal event
      await expect(perpetual.withdraw(deployerBalance, usdc.address))
        .to.emit(perpetual, 'Withdraw')
        .withArgs(utils.parseEther(deposited), deployer.address, usdc.address);

      // balance should be same as before withdrawal
      expect(await usdc.balanceOf(deployer.address)).to.be.equal(depositAmount);
    });
  });
});
