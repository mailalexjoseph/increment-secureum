import chaiModule = require('../chai-setup');
const {expect} = chaiModule;

import env = require('hardhat');
import {setup, funding, User} from './helpers/setup';
import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';
import {Side} from './helpers/utils/types';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {getChainlinkOracle} from '../../helpers/contracts-deployments';

import {setLatestChainlinkPrice} from './helpers/utils/manipulateStorage';
import {AggregatorV3Interface} from '../../typechain';

// https://docs.chain.link/docs/ethereum-addresses/
const parsePrice = (num: string) => ethers.utils.parseUnits(num, 8);
const formatPrice = (num: BigNumber) => ethers.utils.formatUnits(num, 8);

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

async function logUserPosition(user: User, name: string) {
  console.log(
    name,
    ' owns: notional, positionSize, profit, side, timestamp, cumFundingRate',
    (await user.perpetual.getUserPosition(user.address)).toString()
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
  let liquidityAmount: BigNumber, liquidityWad: BigNumber;
  let oracle: AggregatorV3Interface;

  beforeEach('Set up', async () => {
    ({user, bob, alice} = await setup());
    liquidityAmount = await funding();
    liquidityWad = await tokenToWad(user.usdc, liquidityAmount);
    await user.usdc.approve(user.vault.address, liquidityAmount);
    await bob.usdc.approve(bob.vault.address, liquidityAmount);
    await alice.usdc.approve(alice.vault.address, liquidityAmount);
  });

  async function provideLiquidity(liquidityAmount: BigNumber, user: User) {
    await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);
  }

  async function openPosition(liquidityAmount: BigNumber, user: User) {
    await user.perpetual.deposit(liquidityAmount, user.usdc.address);
    await user.perpetual.openPosition(liquidityWad.mul(10), Side.Long); // 10x leverage long
  }
  async function closePosition(user: User) {
    await user.perpetual.closePosition();
    const aliceDeposits = await alice.vault.getReserveValue(alice.address);
    await user.perpetual.withdraw(aliceDeposits, user.usdc.address);
  }

  async function withdrawLiquidity(user: User) {
    const providedLiquidity = (
      await user.perpetual.liquidityPosition(user.address)
    )[0];

    await user.perpetual.withdrawLiquidity(
      providedLiquidity,
      user.usdc.address
    );
  }

  async function changeOraclePrice(price: BigNumber) {
    oracle = await ethers.getContractAt(
      'AggregatorV3Interface',
      await getChainlinkOracle(env, 'EUR_USD')
    );
    await setLatestChainlinkPrice(env, oracle, price);
  }

  async function checks() {
    // start: balanceOf(trader) + balanceOf(liquidityProvider) <= end: balanceOf(trader) + balanceOf(liquidityProvider)
    const userBalanceAfter = await user.usdc.balanceOf(user.address);
    const aliceBalanceAfter = await alice.usdc.balanceOf(alice.address);
    expect(userBalanceAfter.add(aliceBalanceAfter)).to.be.lte(
      liquidityAmount.mul(2)
    );
  }
  describe('One LP & one Trader', async function () {
    describe('Should payout with no oracle price change', async function () {
      it('LP provides liquidity, trader opens and closes a position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, user);

        await openPosition(liquidityAmount, alice);

        await closePosition(alice);

        await withdrawLiquidity(user);

        // check results
        await checks();
        expect(await user.usdc.balanceOf(user.vault.address)).to.be.equal(1);
        expect(await user.vEUR.balanceOf(user.market.address)).to.be.equal('1'); // 1 vBase
        expect(await user.vUSD.balanceOf(user.market.address)).to.be.equal('2'); // 2 vQuote
      });
    });
    describe('Should payout with oracle price increase', async function () {
      it.only('EUR/USD increases, LP provides liquidity, trader opens,  trader closes a position, LP withdraws liquidity', async function () {
        // change price
        await changeOraclePrice(parsePrice('1.1'));

        await provideLiquidity(liquidityAmount, user);

        await openPosition(liquidityAmount, alice);

        await closePosition(alice);

        await withdrawLiquidity(user);

        // check results
        await checks();
        await logUserBalance(user, 'user');
        await logUserBalance(alice, 'alice');
        await logVaultBalance(user);
      });
      it.only('LP provides liquidity, EUR/USD increases, trader opens,  trader closes a position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, user);

        // change price
        await changeOraclePrice(parsePrice('1.1'));

        await openPosition(liquidityAmount, alice);

        await closePosition(alice);

        await withdrawLiquidity(user);

        // check results
        await checks();
        await logUserBalance(user, 'user');
        await logUserBalance(alice, 'alice');
        await logVaultBalance(user);
      });
      it.only('LP provides liquidity, trader opens, EUR/USD increases, trader closes a position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, user);

        await openPosition(liquidityAmount, alice);

        // change price
        await changeOraclePrice(parsePrice('1.1'));

        await closePosition(alice);

        await withdrawLiquidity(user);

        // check results
        await checks();
        await logUserBalance(user, 'user');
        await logUserBalance(alice, 'alice');
        await logVaultBalance(user);
      });

      it.only('LP provides liquidity,trader opens,  trader closes a position, EUR/USD increases, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, user);

        await openPosition(liquidityAmount, alice);

        await closePosition(alice);

        // change price
        await changeOraclePrice(parsePrice('1.1'));

        await withdrawLiquidity(user);

        // check results
        await checks();
        await logUserBalance(user, 'user');
        await logUserBalance(alice, 'alice');
        await logVaultBalance(user);
      });
    });
    describe('Should payout with oracle price decrease', async function () {
      it.only('EUR/USD decreases, LP provides liquidity, trader opens,  trader closes a position, LP withdraws liquidity', async function () {
        // change price
        await changeOraclePrice(parsePrice('1'));

        await provideLiquidity(liquidityAmount, user);

        await openPosition(liquidityAmount, alice);

        await closePosition(alice);

        await withdrawLiquidity(user);

        // check results
        await checks();
        await logUserBalance(user, 'user');
        await logUserBalance(alice, 'alice');
        await logVaultBalance(user);
      });
      it.only('LP provides liquidity, EUR/USD decreases, trader opens,  trader closes a position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, user);

        // change price
        await changeOraclePrice(parsePrice('1'));

        await openPosition(liquidityAmount, alice);

        await closePosition(alice);

        await withdrawLiquidity(user);

        // check results
        await checks();
        await logUserBalance(user, 'user');
        await logUserBalance(alice, 'alice');
        await logVaultBalance(user);
      });
      it.only('LP provides liquidity, trader opens, EUR/USD decreases, trader closes a position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, user);

        await openPosition(liquidityAmount, alice);

        // change price
        await changeOraclePrice(parsePrice('1'));

        await closePosition(alice);

        await withdrawLiquidity(user);

        // check results
        await checks();
        await logUserBalance(user, 'user');
        await logUserBalance(alice, 'alice');
        await logVaultBalance(user);
      });

      it.only('LP provides liquidity,trader opens,  trader closes a position, EUR/USD decreases, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, user);

        await openPosition(liquidityAmount, alice);

        await closePosition(alice);

        // change price
        await changeOraclePrice(parsePrice('1'));

        await withdrawLiquidity(user);

        // check results
        await checks();
        await logUserBalance(user, 'user');
        await logUserBalance(alice, 'alice');
        await logVaultBalance(user);
      });
    });
  });
});
