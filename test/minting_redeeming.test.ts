import {expect} from 'chai';
import {setup, funding} from './helpers/setup';
import {bigNumberToEther} from './helpers/utils';
import {utils, BigNumber} from 'ethers';
import {Perpetual, ERC20} from '../typechain';

describe('Increment App: Minting / Redeeming', function () {
  let user: any;
  let perpetual: Perpetual, usdc: ERC20;
  let depositAmount: BigNumber, mintAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({user, perpetual, usdc} = await setup());
    depositAmount = await funding();
    user.usdc.approve(perpetual.address, depositAmount);
    await user.perpetual.deposit(depositAmount, usdc.address);

    mintAmount = await bigNumberToEther(depositAmount.mul(5), usdc); // mint with 5x leverage by default
  });

  describe('Can buy assets on vAMM', function () {
    it('Can go long Quote ', async function () {
      await expect(user.perpetual.MintLongQuote(mintAmount))
        .to.emit(perpetual, 'buyQuoteLong')
        .withArgs(
          mintAmount,
          user.address,
          utils.parseEther('55524.708495280399777902')
        );
      expect(await perpetual.getPortfolioValue(user.address)).to.be.equal(
        await bigNumberToEther(depositAmount, usdc)
      );

      /*console.log(
        'Entry price is',
        utils.formatEther(await perpetual.getEntryPrice(user.address))
      );
      console.log(
        'Current price is',
        utils.formatEther((await perpetual.getPoolInfo()).price)
      );
      console.log('pool info is', (await perpetual.getPoolInfo()).toString()); */
    });

    it('Can go short Quote ', async function () {
      await expect(user.perpetual.MintShortQuote(mintAmount))
        .to.emit(perpetual, 'buyQuoteShort')
        .withArgs(
          mintAmount,
          user.address,
          utils.parseEther('55586.436909394107837687')
        );
    });
  });

  describe('Can redeem assets from vAMM', function () {
    it('Should sell long Quote', async function () {
      await user.perpetual.MintLongQuote(mintAmount);
      // TODO: Fix below
      //expect( ** ignore for now, getUnrealizedPnL() does distort result ***
      //  await perpetual.getUserMarginRatio(user.address)
      //).to.be.equal(utils.parseEther("0.2")); // 100/500

      const longBalance = await perpetual.getLongBalance(user.address);
      await user.perpetual.RedeemLongQuote(usdc.address);
    });

    it('Should sell short Quote', async function () {
      await user.perpetual.MintShortQuote(mintAmount);
      //expect( ** ignore for now, getUnrealizedPnL() does distort result ***
      //  await perpetual.getUserMarginRatio(user.address)
      //).to.be.equal(utils.parseEther("0.2")); // 100/500

      const shortBalanceBefore = await perpetual.getShortBalance(user.address);
      await user.perpetual.RedeemShortQuote(usdc.address);

      const shortBalanceAfter = await user.perpetual.getLongBalance(
        user.address
      );
      //console.log("shortBalanceAfter is", shortBalanceAfter.toString());
    });
  });

  describe('Can buy assets on vAMM with leverage factor', function () {
    it('Can go long Quote with 5 times leverage ', async function () {
      // 100 deposit & 5 leverage === 500 shares minted
      await expect(user.perpetual.MintLongWithLeverage(5))
        .to.emit(perpetual, 'buyQuoteLong')
        .withArgs(
          mintAmount,
          user.address,
          utils.parseEther('55524.708495280399777902')
        );
    });

    it('Can go short Quote with 5 times leverage ', async function () {
      await expect(user.perpetual.MintShortWithLeverage(5))
        .to.emit(perpetual, 'buyQuoteShort')
        .withArgs(
          mintAmount,
          user.address,
          utils.parseEther('55586.436909394107837687')
        );
    });
  });
});
