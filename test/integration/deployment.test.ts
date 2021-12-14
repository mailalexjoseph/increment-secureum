import {setup} from './helpers/setup';

import chaiModule = require('../chai-setup');
const {expect} = chaiModule;

describe('Increment Protocol: Deployment', function () {
  describe('Deployment', function () {
    it('Should initialize Perpetual with its dependencies', async function () {
      const {deployer} = await setup();

      expect(await deployer.perpetual.vault()).to.equal(deployer.vault.address);
      expect(await deployer.perpetual.oracle()).to.equal(
        deployer.oracle.address
      );
      expect(await deployer.perpetual.market()).to.equal(
        deployer.market.address
      );
      expect(await deployer.perpetual.vBase()).to.equal(deployer.vEUR.address);
      expect(await deployer.perpetual.vQuote()).to.equal(deployer.vUSD.address);
    });

    it('Should initialize Vault with its dependencies and Perpetual as its owner', async function () {
      const {deployer} = await setup();

      expect(await deployer.vault.owner()).to.be.equal(
        deployer.perpetual.address
      );
      expect(await deployer.vault.reserveToken()).to.be.equal(
        deployer.usdc.address
      );
      expect(await deployer.vault.oracle()).to.be.equal(
        deployer.oracle.address
      );
      expect(await deployer.vault.totalReserveToken()).to.be.equal(0);
    });

    it('Should initialize vBase and vQuote with Perpetual as their owner', async function () {
      const {deployer} = await setup();

      expect(await deployer.vEUR.owner()).to.be.equal(
        deployer.perpetual.address
      );
      expect(await deployer.vEUR.symbol()).to.be.equal('vEUR');

      expect(await deployer.vUSD.owner()).to.be.equal(
        deployer.perpetual.address
      );
      expect(await deployer.vUSD.symbol()).to.be.equal('vUSD');
    });
  });
});
