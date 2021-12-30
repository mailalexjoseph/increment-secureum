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
    it('Should initialize CurveSwap with correct parameters', async function () {
      // const {deployer} = await setup();
      // expect(await deployer.market.owner()).to.be.equal(deployer.address);
      // console.log('await deployer.market.token()');
      // console.log((await deployer.market.token()).toString());
      // console.log('await deployer.market.A()');
      // console.log((await deployer.market.A()).toString());
      // console.log('await deployer.market.gamma()');
      // console.log((await deployer.market.gamma()).toString());
      // console.log('await deployer.market.price_scale()');
      // console.log((await deployer.market.price_scale()).toString());
      // console.log('await deployer.market.price_oracle()');
      // console.log((await deployer.market.price_oracle()).toString());
      // console.log('await deployer.market.last_prices()');
      // console.log((await deployer.market.last_prices()).toString());
      // console.log('await deployer.market.last_prices_timestamp()');
      // console.log((await deployer.market.last_prices_timestamp()).toString());
      // console.log('await deployer.market.initial_A_gamma()');
      // console.log((await deployer.market.initial_A_gamma()).toString());
      // console.log('await deployer.market.future_A_gamma()');
      // console.log((await deployer.market.future_A_gamma()).toString());
      // console.log('await deployer.market.initial_A_gamma_time()');
      // console.log((await deployer.market.initial_A_gamma_time()).toString());
      // console.log('await deployer.market.future_A_gamma_time()');
      // console.log((await deployer.market.future_A_gamma_time()).toString());
      // console.log('await deployer.market.allowed_extra_profit()');
      // console.log((await deployer.market.allowed_extra_profit()).toString());
      // console.log('await deployer.market.future_allowed_extra_profit()');
      // console.log(
      //   (await deployer.market.future_allowed_extra_profit()).toString()
      // );
      // console.log('await deployer.market.fee_gamma()');
      // console.log((await deployer.market.fee_gamma()).toString());
      // console.log('await deployer.market.future_fee_gamma()');
      // console.log((await deployer.market.future_fee_gamma()).toString());
      // console.log('await deployer.market.adjustment_step()');
      // console.log((await deployer.market.adjustment_step()).toString());
      // console.log('await deployer.market.future_adjustment_step()');
      // console.log((await deployer.market.future_adjustment_step()).toString());
      // console.log('await deployer.market.ma_half_time()');
      // console.log((await deployer.market.ma_half_time()).toString());
      // console.log('await deployer.market.future_ma_half_time()');
      // console.log((await deployer.market.future_ma_half_time()).toString());
      // console.log('await deployer.market.mid_fee()');
      // console.log((await deployer.market.mid_fee()).toString());
      // console.log('await deployer.market.out_fee()');
      // console.log((await deployer.market.out_fee()).toString());
      // console.log('await deployer.market.admin_fee()');
      // console.log((await deployer.market.admin_fee()).toString());
      // console.log('await deployer.market.future_mid_fee()');
      // console.log((await deployer.market.future_mid_fee()).toString());
      // console.log('await deployer.market.future_out_fee()');
      // console.log((await deployer.market.future_out_fee()).toString());
      // console.log('await deployer.market.future_admin_fee()');
      // console.log((await deployer.market.future_admin_fee()).toString());
      // console.log('await deployer.market.D()');
      // console.log((await deployer.market.D()).toString());
      // console.log('await deployer.market.owner()');
      // console.log((await deployer.market.owner()).toString());
      // console.log('await deployer.market.future_owner()');
      // console.log((await deployer.market.future_owner()).toString());
      // console.log('await deployer.market.xcp_profit()');
      // console.log((await deployer.market.xcp_profit()).toString());
      // console.log('await deployer.market.xcp_profit_a()');
      // console.log((await deployer.market.xcp_profit_a()).toString());
      // console.log('await deployer.market.virtual_price()');
      // console.log((await deployer.market.virtual_price()).toString());
      // console.log('await deployer.market.is_killed()');
      // console.log((await deployer.market.is_killed()).toString());
      // console.log('await deployer.market.kill_deadline()');
      // console.log((await deployer.market.kill_deadline()).toString());
      // console.log('await deployer.market.transfer_ownership_deadline()');
      // console.log(
      //   (await deployer.market.transfer_ownership_deadline()).toString()
      // );
      // console.log('await deployer.market.admin_actions_deadline()');
      // console.log((await deployer.market.admin_actions_deadline()).toString());
      // console.log('await deployer.market.admin_fee_receiver()');
      // console.log((await deployer.market.admin_fee_receiver()).toString());
      // /* fails */
      // console.log('await deployer.market.fee()');
      // console.log((await deployer.market.fee()).toString);
      // console.log('await deployer.market.get_virtual_price()');
      // console.log((await deployer.market.get_virtual_price()).toString());
      // sound state changing to me :(
      // await deployer.market.stop_ramp_A_gamma();
      // await deployer.market.claim_admin_fees();
      // await deployer.market.apply_new_parameters();
      // await deployer.market.revert_new_parameters();
      // await deployer.market.apply_transfer_ownership();
      // await deployer.market.revert_transfer_ownership();
      // await deployer.market.kill_me();
      // await deployer.market.unkill_me();
      // functions with input
      // await deployer.market.coins(uint256) ;
      // await deployer.market.exchange(uint256,uint256,uint256,uint256) ;
      // await deployer.market.get_dy(uint256,uint256,uint256) ;
      // await deployer.market.add_liquidity(uint256[2],uint256) ;
      // await deployer.market.remove_liquidity(uint256,uint256[2]) ;
      // await deployer.market.calc_token_amount(uint256[2]) ;
      // await deployer.market.calc_withdraw_one_coin(uint256,uint256) ;
      // await deployer.market.remove_liquidity_one_coin(uint256,uint256,uint256) ;
      // await deployer.market.ramp_A_gamma(uint256,uint256,uint256) ;
      // await deployer.market.commit_new_parameters(uint256,uint256,uint256,uint256,uint256,uint256,uint256) ;
      // await deployer.market.commit_transfer_ownership(address) ;
      // await deployer.market.set_admin_fee_receiver(address) ;
      // await deployer.market.balances(uint256) ;
    });
  });
});
