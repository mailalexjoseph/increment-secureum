import {expect} from 'chai';
import {setup, funding} from './helpers/setup';
import {convertToCurrencyUnits} from '../helpers/contracts-helpers';
import {utils, BigNumber} from 'ethers';
import {Perpetual, ERC20} from '../typechain';

describe('Increment App: Settlement', function () {
  let user: any, deployer: any;
  let perpetual: Perpetual, usdc: ERC20;
  let depositAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({user, deployer, perpetual, usdc} = await setup());
    depositAmount = await funding();
    user.usdc.approve(perpetual.address, depositAmount);
    await user.perpetual.deposit(depositAmount, usdc.address);
  });

  describe('Funding', function () {
    it('Should update the funding rate and make long settlement ', async function () {
      await expect(deployer.perpetual.pushSnapshot());

      const mintAmount = utils.parseEther('500');
      await expect(user.perpetual.MintLongQuote(mintAmount))
        .to.emit(perpetual, 'buyQuoteLong')
        .withArgs(
          mintAmount,
          user.address,
          utils.parseEther('55524.708495280399777902')
        );

      await deployer.perpetual.updateFundingRate();

      const fundingRate = await perpetual.getFundingRate();

      await user.perpetual.RedeemLongQuote(usdc.address);

      const usdcBalanceAfter = await perpetual.getReserveBalance(
        user.address,
        usdc.address
      );

      const total = usdcBalanceAfter.add(fundingRate.value);
      expect(total).to.be.equal(utils.parseEther('100')); //
    });
    it('Should update the funding rate and make short settlement ', async function () {
      await expect(deployer.perpetual.pushSnapshot());

      const mintAmount = utils.parseEther('500');
      await expect(user.perpetual.MintShortQuote(mintAmount))
        .to.emit(perpetual, 'buyQuoteShort')
        .withArgs(
          mintAmount,
          user.address,
          utils.parseEther('55586.436909394107837687')
        );

      await deployer.perpetual.updateFundingRate();

      const fundingRate = await perpetual.getFundingRate();

      await user.perpetual.RedeemShortQuote(usdc.address);

      const usdcBalanceAfter = await perpetual.getReserveBalance(
        user.address,
        usdc.address
      );

      const total = usdcBalanceAfter.add(fundingRate.value);
      //expect(total).to.be.equal(utils.parseEther('100')); //
    });
  });
});
