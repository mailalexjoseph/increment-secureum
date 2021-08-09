import env = require('hardhat');
import {BigNumber} from 'ethers';
import {expect} from 'chai';
import {utils} from 'ethers';
import {
  getChainlinkForexAggregator,
  getReserveOracleAddress,
} from '../helpers/contract-getters';
import {getEthereumNetworkFromHRE} from '../helpers/misc-utils';
import {setup} from './helpers/setup';

describe('Increment App: Deployment', function () {
  describe('Deployment', function () {
    it('Should initialize vAMM pool', async function () {
      const {deployer, vAMMconfig} = await setup();

      const pool = await deployer.perpetual.getPoolInfo();

      // correct reserve tokens

      expect(pool.vQuote).to.be.equal(vAMMconfig.QuoteAssetReserve);
      expect(pool.vBase).to.be.equal(vAMMconfig.BaseAssetReserve);

      // check pool price
      const normalizationConstantEther = utils.parseUnits('1', 18);
      const expectPrice = vAMMconfig.BaseAssetReserve.mul(
        normalizationConstantEther
      ).div(vAMMconfig.QuoteAssetReserve);
      expect(pool.price).to.be.equal(expectPrice);

      // check pool constant
      const normalizationConstant = utils.parseUnits('1', 38); /// adjust by big number to avoid overflow error from chai library
      const expectTotalAssetReserve: BigNumber =
        vAMMconfig.QuoteAssetReserve.mul(vAMMconfig.BaseAssetReserve).div(
          normalizationConstant
        );

      const realizedTotalAssetReserve: BigNumber = pool.totalAssetReserve.div(
        normalizationConstant
      );
      expect(expectTotalAssetReserve).to.be.equal(realizedTotalAssetReserve);
    });

    it('Should initialize forex oracle', async function () {
      const {deployer} = await setup();

      expect(await deployer.perpetual.getQuoteAssetOracle()).to.be.equal(
        getChainlinkForexAggregator('JPY_USD', getEthereumNetworkFromHRE(env))
      );
    });
    it('Should initialize reserve assets oracle', async function () {
      const {deployer} = await setup();

      expect(
        await deployer.perpetual.getAssetOracle(deployer.usdc.address)
      ).to.be.equal(
        getReserveOracleAddress('USDC', getEthereumNetworkFromHRE(env))
      );
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
