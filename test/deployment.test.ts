import {BigNumber} from 'ethers';

import {expect} from 'chai';
import {utils} from 'ethers';

import {setup} from './helpers/setup';

describe('Increment App: Deployment', function () {
  describe('Deployment', function () {
    it('Should initialize vAMM pool', async function () {
      const {deployer, data} = await setup();

      const pool = await deployer.perpetual.getPoolInfo();

      // correct reserve tokens

      expect(pool.vQuote).to.be.equal(data.QuoteAssetReserve);
      expect(pool.vBase).to.be.equal(data.BaseAssetReserve);

      // check pool price
      const normalizationConstantEther = utils.parseUnits('1', 18);
      const expectPrice: BigNumber = data.BaseAssetReserve.mul(
        normalizationConstantEther
      ).div(data.QuoteAssetReserve);
      expect(pool.price).to.be.equal(expectPrice);

      // check pool constant
      const normalizationConstant = utils.parseUnits('1', 38); /// adjust by big number to avoid overflow error from chai library
      const expectTotalAssetReserve: BigNumber = data.QuoteAssetReserve.mul(
        data.BaseAssetReserve
      ).div(normalizationConstant);

      const realizedTotalAssetReserve: BigNumber = pool.totalAssetReserve.div(
        normalizationConstant
      );
      expect(expectTotalAssetReserve).to.be.equal(realizedTotalAssetReserve);
    });
    /*
    it('Should initialize oracles', async function () {
      const {deployer, perpetual} = await setup();
      expect(
        await perpetual.connect(deployer).getQuoteAssetOracle()
      ).to.be.equal(jpy_oracle.address);
      expect(
        await perpetual.connect(deployer).getAssetOracle(usdc.address)
      ).to.be.equal(usdc_oracle.address);
    });
    it('Should set reserve asset', async function () {
      const {deployer, perpetual} = await setup();
      const tokens = await perpetual.getReserveAssets();
      expect(tokens[0]).to.be.equal(usdc.address);
    });
    it('Should give deployer role to deployer address', async function () {
      const {deployer, perpetual} = await setup();
      expect(await perpetual.owner()).to.be.equal(deployer.address);
    });
    */
  });
});
