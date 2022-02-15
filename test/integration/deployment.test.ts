import {expect} from 'chai';
import env = require('hardhat');

import {setup} from '../helpers/setup';
import {getCryptoSwapConstructorArgs} from '../../helpers/contracts-deployments';
import {getChainlinkPrice} from '../../helpers/contracts-getters';

describe.only('Increment Protocol: Deployment', function () {
  describe.only('Deployment', function () {
    it('Should initialize Perpetual with its dependencies', async function () {
      const {deployer} = await setup();

      expect(await deployer.perpetual.vault()).to.equal(deployer.vault.address);
      expect(await deployer.perpetual.chainlinkOracle()).to.equal(
        deployer.chainlinkOracle.address
      );
      expect(await deployer.perpetual.market()).to.equal(
        deployer.market.address
      );
      expect(await deployer.perpetual.vBase()).to.equal(deployer.vBase.address);
      expect(await deployer.perpetual.vQuote()).to.equal(
        deployer.vQuote.address
      );
      expect(await deployer.perpetual.insurance()).to.equal(
        deployer.insurance.address
      );
    });

    it('Should initialize Vault with its dependencies and Perpetual as its owner', async function () {
      const {deployer} = await setup();

      expect(await deployer.vault.owner()).to.be.equal(deployer.address);
      expect(await deployer.vault.owner()).to.be.equal(deployer.address);
      expect(await deployer.vault.isAllowListed(deployer.perpetual.address)).to
        .be.true;
      expect(await deployer.vault.reserveToken()).to.be.equal(
        deployer.usdc.address
      );
      expect(await deployer.vault.chainlinkOracle()).to.be.equal(
        deployer.chainlinkOracle.address
      );
      expect(await deployer.vault.totalReserveToken()).to.be.equal(0);
    });

    it('Should initialize vBase and vQuote with Perpetual as their owner', async function () {
      const {deployer} = await setup();

      expect(await deployer.vBase.owner()).to.be.equal(
        deployer.perpetual.address
      );
      expect(await deployer.vBase.symbol()).to.be.equal('vEUR');

      expect(await deployer.vQuote.owner()).to.be.equal(
        deployer.perpetual.address
      );
      expect(await deployer.vQuote.symbol()).to.be.equal('vUSD');
    });
    it('Should initialize CurveSwap with correct parameters', async function () {
      const {deployer} = await setup();

      // change depending on pair you want to deploy
      const initialPrice = await getChainlinkPrice(env, 'EUR_USD');
      const args = getCryptoSwapConstructorArgs(
        'EUR_USD',
        deployer.vQuote.address,
        deployer.vBase.address,
        initialPrice
      );

      // coins
      expect(await deployer.market.coins(0)).to.be.equal(args._coins[0]);
      expect(await deployer.market.coins(1)).to.be.equal(args._coins[1]);
      expect(await deployer.curveToken.minter()).to.be.equal(
        deployer.market.address
      );
      expect(await deployer.market.token()).to.be.equal(
        deployer.curveToken.address
      );

      // constructor parameters
      expect(await deployer.market.A()).to.be.equal(args.A);
      expect(await deployer.market.gamma()).to.be.equal(args.gamma);

      expect(await deployer.market.mid_fee()).to.be.equal(args.mid_fee);
      expect(await deployer.market.out_fee()).to.be.equal(args.out_fee);
      expect(await deployer.market.allowed_extra_profit()).to.be.equal(
        args.allowed_extra_profit
      );
      expect(await deployer.market.fee_gamma()).to.be.equal(args.fee_gamma);
      expect(await deployer.market.adjustment_step()).to.be.equal(
        args.adjustment_step
      );
      expect(await deployer.market.admin_fee()).to.be.equal(args.admin_fee);
      expect(await deployer.market.ma_half_time()).to.be.equal(
        args.ma_half_time
      );

      expect(await deployer.market.price_scale()).to.be.equal(
        args.initial_price
      );
      expect(await deployer.market.price_oracle()).to.be.equal(
        args.initial_price
      );
      expect(await deployer.market.last_prices()).to.be.equal(
        args.initial_price
      );
    });
    it('Should deploy Insurance with correct parameters', async function () {
      const {deployer} = await setup();

      expect(await deployer.insurance.token()).to.be.equal(
        deployer.usdc.address
      );
      expect(await deployer.insurance.vault()).to.be.equal(
        deployer.vault.address
      );
      expect(await deployer.insurance.owner()).to.be.equal(deployer.address);
    });
  });
});
