import {expect} from 'chai';
import {setup} from './helpers/setup';
import {ethers} from 'hardhat';
import {utils} from 'ethers';
import {Perpetual} from '../typechain';
import {getBlockTime} from '../helpers/contracts-helpers';
import {iVAMMConfig} from '../helpers/types';

describe('Increment App: Funding rate', function () {
  let deployer: any;
  let perpetual: Perpetual;
  let vAMMconfig: iVAMMConfig;

  beforeEach('Set up', async () => {
    ({deployer, perpetual, vAMMconfig} = await setup());
  });

  describe('Funding', function () {
    it('Should take a snapshot of vAMM price ', async function () {
      const normalizationConstantEther = utils.parseUnits('1', 18);
      const expectedPrice = vAMMconfig.BaseAssetReserve.mul(
        normalizationConstantEther
      ).div(vAMMconfig.QuoteAssetReserve);
      await expect(deployer.perpetual.pushSnapshot())
        .to.emit(deployer.perpetual, 'LogSnapshot')
        .withArgs(await getBlockTime(), expectedPrice, 0);
      const firstSnapshot = await deployer.perpetual.getVAMMsnapshots(0);
      expect(firstSnapshot.price).to.be.equal(expectedPrice);
    });
    it('Should update the funding rate ', async function () {
      await expect(deployer.perpetual.pushSnapshot());
      await deployer.perpetual.updateFundingRate();
      await deployer.perpetual.updateFundingRate();
      await deployer.perpetual.updateFundingRate();

      const fundingRate = await perpetual.getFundingRate();
      console.log('fundingRate is', utils.formatEther(fundingRate.value));
    });
  });
});
