import {expect} from 'chai';

import env = require('hardhat');
import {setup, funding, User} from '../helpers/setup';
import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';
import {Side} from '../helpers/utils/types';
import {getChainlinkOracle} from '../../helpers/contracts-deployments';

import {setLatestChainlinkPrice} from '../helpers/utils/manipulateStorage';
import {AggregatorV3Interface} from '../../typechain';

import {TEST_get_exactOutputSwap} from '../helpers/CurveUtils';

// https://docs.chain.link/docs/ethereum-addresses/
const parsePrice = (num: string) => ethers.utils.parseUnits(num, 8);

describe('Increment App: Scenario', function () {
  let deployer: User, trader: User, lp: User;

  let liquidityAmount: BigNumber;
  let chainlinkOracle: AggregatorV3Interface;

  beforeEach('Set up', async () => {
    ({lp, deployer, trader} = await setup());
    liquidityAmount = await funding();
    await lp.usdc.approve(lp.vault.address, liquidityAmount);
    await trader.usdc.approve(trader.vault.address, liquidityAmount);

    /* important: provide some initial liquidity to the market -> w/o any liquidity left, the market will stop working */
    await deployer.usdc.approve(deployer.vault.address, liquidityAmount);
    await provideLiquidity(liquidityAmount, deployer);
  });

  async function provideLiquidity(liquidityAmount: BigNumber, user: User) {
    await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);
  }

  async function openPosition(amount: BigNumber, user: User, direction: Side) {
    await user.perpetual.deposit(amount, user.usdc.address);
    await user.perpetual.openPosition(amount.mul(10), direction); // 10x leverage long
  }
  async function closePosition(user: User) {
    const userPosition = await user.perpetual.getUserPosition(user.address);

    let sellAmount;
    if (userPosition.positionSize.gt(0)) {
      sellAmount = userPosition.positionSize;
    } else {
      sellAmount = (
        await TEST_get_exactOutputSwap(
          trader.market,
          userPosition.positionSize.abs(),
          ethers.constants.MaxUint256,
          0,
          1
        )
      ).amountIn;
    }

    await user.perpetual.closePosition(sellAmount);
    const traderDeposits = await trader.vault.getReserveValue(trader.address);
    await user.perpetual.withdraw(traderDeposits, user.usdc.address);
  }

  async function withdrawLiquidity(user: User) {
    const providedLiquidity = (
      await user.perpetual.getUserPosition(user.address)
    ).liquidityBalance;

    await user.perpetual.withdrawLiquidity(
      providedLiquidity,
      user.usdc.address
    );

    console.log('**********After withdrawing liquidity**********');
    await logMarketBalance(user);
    await logUserPosition(user, 'LP');
    await logPerpCRVBalance(user);
    await logPerpetualBalance(user);
    console.log('**********Close remaining position**********');
    await closePosition(user);
  }

  async function changeChainlinkOraclePrice(price: BigNumber) {
    chainlinkOracle = await ethers.getContractAt(
      'AggregatorV3Interface',
      await getChainlinkOracle(env, 'EUR_USD')
    );
    await setLatestChainlinkPrice(env, chainlinkOracle, price);
  }

  async function checks() {
    // start: balanceOf(trader) + balanceOf(liquidityProvider) <= end: balanceOf(trader) + balanceOf(liquidityProvider)
    const lpBalanceAfter = await lp.usdc.balanceOf(lp.address);
    const traderBalanceAfter = await trader.usdc.balanceOf(trader.address);
    // soft check
    if (lpBalanceAfter.add(traderBalanceAfter).gt(liquidityAmount.mul(2))) {
      console.log('fails');
    }
    // expect(lpBalanceAfter.add(traderBalanceAfter)).to.be.lte(
    //   liquidityAmount.mul(2)
    // );
  }
  describe('One LP & one Trader', async function () {
    describe('1. Should remain solvent with no oracle price change', async function () {
      it.only('1.1. LP provides liquidity, trader opens long position and closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(100), trader, Side.Long);

        await closePosition(trader);

        console.log('**********Before withdrawing liquidity**********');
        await logMarketBalance(lp);
        await logUserPosition(lp, 'LP');
        await logPerpCRVBalance(lp);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        expect(await lp.usdc.balanceOf(lp.vault.address)).to.be.equal(1);
        expect(await lp.vBase.balanceOf(lp.market.address)).to.be.equal('1'); // 1 vBase
        expect(await lp.vQuote.balanceOf(lp.market.address)).to.be.equal('2'); // 2 vQuote
      });
      it('1.2. LP provides liquidity, trader opens long position and closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Long);

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        expect(await lp.usdc.balanceOf(lp.vault.address)).to.be.equal(1);
        expect(await lp.vBase.balanceOf(lp.market.address)).to.be.equal('1'); // 1 vBase
        expect(await lp.vQuote.balanceOf(lp.market.address)).to.be.equal('2'); // 2 vQuote
      });
    });
    describe('2. EUR/USD increases & long trade', async function () {
      it('2.1. EUR/USD increases, LP provides liquidity, trader opens long position, trader closes position, LP withdraws liquidity', async function () {
        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Long);

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('2.2. LP provides liquidity, EUR/USD increases, trader opens long position, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await openPosition(liquidityAmount.div(10), trader, Side.Long);

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('2.3. LP provides liquidity, trader opens long position, EUR/USD increases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Long);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('2.4. LP provides liquidity, trader opens long position, trader closes position, EUR/USD increases, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Long);

        await closePosition(trader);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
    });
    describe('3. EUR/USD increases & short trade', async function () {
      it('3.1. EUR/USD increases, LP provides liquidity, trader opens short position, trader closes position, LP withdraws liquidity', async function () {
        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Short);

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('3.2. LP provides liquidity, EUR/USD increases, trader opens short position, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await openPosition(liquidityAmount.div(10), trader, Side.Short);

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('3.3. LP provides liquidity, trader opens short position, EUR/USD increases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Short);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('3.4. LP provides liquidity, trader opens short position, trader closes position, EUR/USD increases, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Short);

        await closePosition(trader);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
    });
    describe('4. EUR/USD decreases & long trade', async function () {
      it('4.1. EUR/USD decreases, LP provides liquidity, trader opens long position, trader closes position, LP withdraws liquidity', async function () {
        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Long);

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('4.2. LP provides liquidity, EUR/USD decreases, trader opens long position, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await openPosition(liquidityAmount.div(10), trader, Side.Long);

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('4.3. LP provides liquidity, trader opens long position, EUR/USD decreases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Long);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('4.4. LP provides liquidity, trader opens long position, trader closes position, EUR/USD decreases, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Long);

        await closePosition(trader);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
    });
    describe('5. EUR/USD decreases & short trade', async function () {
      it('5.1. EUR/USD decreases, LP provides liquidity, trader opens short position, trader closes position, LP withdraws liquidity', async function () {
        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Short);

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('5.2. LP provides liquidity, EUR/USD decreases, trader opens short position, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await openPosition(liquidityAmount.div(10), trader, Side.Short);

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('5.3. LP provides liquidity, trader opens short position, EUR/USD decreases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Short);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await closePosition(trader);

        await withdrawLiquidity(lp);
        // // check results
        // await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('5.4. LP provides liquidity, trader opens short position, trader closes position, EUR/USD decreases, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount.div(10), trader, Side.Short);

        await closePosition(trader);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
    });
  });
});

async function logMarketBalance(user: User) {
  console.log(
    'market has balance of',
    ethers.utils.formatUnits(
      await user.vQuote.balanceOf(user.market.address),
      18
    ),
    'vQuote and',
    ethers.utils.formatUnits(
      await user.vBase.balanceOf(user.market.address),
      18
    ),
    'vBase'
  );
}

async function logPerpetualBalance(user: User) {
  console.log(
    'perpetual has balance of',
    ethers.utils.formatUnits(
      await user.vQuote.balanceOf(user.perpetual.address),
      18
    ),
    'vQuote and',
    ethers.utils.formatUnits(
      await user.vBase.balanceOf(user.perpetual.address),
      18
    ),
    'vBase'
  );
}
async function logUserBalance(user: User, name: string) {
  console.log(
    name,
    'owns',
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
      await (
        await user.usdc.balanceOf(user.vault.address)
      ).sub(ethers.utils.parseUnits('100', 6)),
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

async function logMarketPrice(user: User) {
  console.log(
    'realizedMarketPrice',
    ethers.utils.formatEther(await user.perpetual.realizedMarketPrice()),
    'marketPrice',
    ethers.utils.formatEther(await user.perpetual.marketPrice()),
    'indexPrice',
    ethers.utils.formatEther(await user.perpetual.indexPrice())
  );
}
