import {expect} from 'chai';
import {setup, funding} from './helpers/setup';
import {convertToCurrencyUnits} from '../helpers/contracts-helpers';
import {utils, BigNumber} from 'ethers';
import {Perpetual, ERC20} from '../typechain';

describe('Increment App: Reserve', function () {
  let user: any;
  let perpetual: Perpetual, usdc: ERC20;
  let depositAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({user, perpetual, usdc} = await setup());
    depositAmount = await funding();
    await user.usdc.approve(perpetual.address, depositAmount);
  });
  describe('Can deposit and withdraw USDC', function () {
    it('Should give allowance to perpetual contract', async function () {
      // should have enough balance to deposit
      expect(await user.usdc.balanceOf(user.address)).to.be.equal(
        depositAmount
      );
      // should succesfully approve
      const allowance = await usdc.allowance(user.address, perpetual.address);
      expect(allowance).to.be.equal(depositAmount);
    });

    it('Should deposit USDC', async function () {
      // should fire up deposit event
      await expect(user.perpetual.deposit(depositAmount, usdc.address))
        .to.emit(perpetual, 'Deposit')
        .withArgs(depositAmount, user.address, usdc.address);

      // should notice deposited amount in asset value / portfolio value
      expect(
        utils.formatEther(
          await perpetual.getAssetValue(user.address, usdc.address)
        )
      ).to.be.equal(await convertToCurrencyUnits(usdc, depositAmount));

      expect(
        utils.formatEther(await perpetual.getPortfolioValue(user.address))
      ).to.be.equal(await convertToCurrencyUnits(usdc, depositAmount));
    });
    it('Should withdraw USDC', async function () {
      await user.perpetual.deposit(depositAmount, usdc.address);

      // withdrawable amount is equal to amount deposited
      const userBalance: BigNumber = await user.perpetual.getReserveBalance(
        user.address,
        usdc.address
      );
      const deposited = await convertToCurrencyUnits(usdc, depositAmount);
      expect(utils.formatEther(userBalance)).to.be.equal(deposited);

      // should fire up withdrawal event
      await expect(user.perpetual.withdraw(userBalance, usdc.address))
        .to.emit(perpetual, 'Withdraw')
        .withArgs(utils.parseEther(deposited), user.address, usdc.address);

      // balance should be same as before withdrawal
      expect(await usdc.balanceOf(user.address)).to.be.equal(depositAmount);
    });
  });
});
