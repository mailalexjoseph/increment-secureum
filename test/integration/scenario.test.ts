import chaiModule = require('../chai-setup');
const {expect} = chaiModule;

import {setup, funding, User} from './helpers/setup';
import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';
import {Side} from './helpers/utils/types';

async function logMarketBalance(user: User) {
  console.log(
    'market has balance of',
    ethers.utils.formatUnits(
      await user.vUSD.balanceOf(user.market.address),
      18
    ),
    'vUSD and',
    ethers.utils.formatUnits(
      await user.vEUR.balanceOf(user.market.address),
      18
    ),
    'vEUR'
  );
}

async function logUserBalance(user: User, name: string) {
  console.log(
    name,
    ' owns',
    ethers.utils.formatUnits(
      await user.usdc.balanceOf(user.address),
      await user.usdc.decimals()
    ),
    'usdc'
  );
}

async function logVaultBalance(user: User) {
  console.log(
    'vault owns',
    ethers.utils.formatUnits(
      await user.usdc.balanceOf(user.vault.address),
      await user.usdc.decimals()
    ),
    'usdc'
  );
}

async function logPerpCRVBalance(user: User) {
  console.log(
    'perpetual owns',
    ethers.utils.formatUnits(
      await user.curve.balanceOf(user.perpetual.address),
      await user.curve.decimals()
    ),
    'curve'
  );
}
describe('Increment App: Scenario', function () {
  let user: User, bob: User, alice: User;
  let liquidityAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({user, bob, alice} = await setup());
    liquidityAmount = await funding();
    await user.usdc.approve(user.vault.address, liquidityAmount);
    await bob.usdc.approve(bob.vault.address, liquidityAmount);
    await alice.usdc.approve(alice.vault.address, liquidityAmount);
  });

  describe('One LP & one Trader', async function () {
    it('LP provides liquidity, trader opens and closes a position, LP withdraws liquidity', async function () {
      // provide liquidity
      await logUserBalance(user, 'user lp');

      await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);

      await logMarketBalance(user);

      await logUserBalance(alice, 'alice trader');

      await logPerpCRVBalance(user);

      await logVaultBalance(user);
      // open position

      const tradeAmount = liquidityAmount;
      const leverage = BigNumber.from(10);
      await alice.perpetual.deposit(tradeAmount, alice.usdc.address);
      await alice.perpetual.openPosition(tradeAmount.mul(leverage), Side.Long);

      await logUserBalance(alice, 'alice trader');

      await logUserBalance(user, 'user lp');

      await logVaultBalance(user);

      // close position
      await alice.perpetual.closePosition();
      const aliceDeposits = await alice.vault.getReserveValue(alice.address);
      await alice.perpetual.withdraw(aliceDeposits, user.usdc.address);

      await logUserBalance(alice, 'alice trader');

      await logVaultBalance(user);

      // withdraw liquidity
      // provide liquidity
      const providedLiquidity = (
        await user.perpetual.liquidityPosition(user.address)
      )[0]; // first element are lp tokens

      await user.perpetual.withdrawLiquidity(
        providedLiquidity,
        user.usdc.address
      );

      await logUserBalance(user, 'user lp');

      expect(await user.vEUR.balanceOf(user.market.address)).to.be.equal('1'); // 1 vBase
      expect(await user.vUSD.balanceOf(user.market.address)).to.be.equal('2'); // 2 vQuote

      await logMarketBalance(user);
      await logVaultBalance(user);
    });
  });
});
