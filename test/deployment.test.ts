import {BigNumber} from 'ethers';
import {expect} from 'chai';
import {utils} from 'ethers';
import {
  getForexOracleAddress,
  getReserveOracleAddress,
} from '../helpers/contract-getters';
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
      const expectPrice = data.BaseAssetReserve.mul(
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

    it('Should initialize oracles', async function () {
      const {deployer} = await setup();

      expect(await deployer.perpetual.getQuoteAssetOracle()).to.be.equal(
        getForexOracleAddress('JPY_USD')
      );
      expect(
        await deployer.perpetual.getAssetOracle(deployer.usdc.address)
      ).to.be.equal(getReserveOracleAddress('USDC'));
    });
    it('Should set reserve asset', async function () {
      const {deployer} = await setup();
      const tokens = await deployer.perpetual.getReserveAssets();
      expect(tokens[0]).to.be.equal(deployer.usdc.address);
    });
    it('Should give deployer role to deployer address', async function () {
      const {deployer} = await setup();
      expect(await deployer.perpetual.owner()).to.be.equal(deployer.address);
    });
  });
});
