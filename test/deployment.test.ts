import {expect} from 'chai';
import {utils} from 'ethers';
import {ZERO_ADDRESS} from '../helpers/constants';
import {setup} from './helpers/setup';

describe('Increment Protocol: Deployment', function () {
  describe('Deployment', function () {
    it('Should initialize Perpetual', async function () {
      const {perpetual, vault, deployer} = await setup();

      expect(await deployer.perpetual.setVault(vault.address)).to;
      expect(await perpetual.isVault(vault.address)).to.be.true;
    });
    it('Should initialize Vault', async function () {
      const {perpetual, usdc, vault} = await setup();

      expect(await vault.getPerpetual()).to.be.equal(perpetual.address);
      expect(await vault.getReserveToken()).to.be.equal(usdc.address);
      expect(await vault.getTotalReserveToken()).to.be.equal(0);
    });
  });
});
