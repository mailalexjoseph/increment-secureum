import {expect} from 'chai';

import env = require('hardhat');
import {setup, funding, User} from '../helpers/setup';
import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';
import {Side} from '../helpers/utils/types';
import {getChainlinkOracle} from '../../helpers/contracts-getters';

import {setLatestChainlinkPrice} from '../helpers/utils/manipulateStorage';
import {AggregatorV3Interface} from '../../typechain';

import {TEST_get_exactOutputSwap} from '../helpers/CurveUtils';

// https://docs.chain.link/docs/ethereum-addresses/
const parsePrice = (num: string) => ethers.utils.parseUnits(num, 8);

async function provideLiquidity(liquidityAmount: BigNumber, user: User) {
  await user.clearingHouse.provideLiquidity(
    0,
    liquidityAmount,
    user.usdc.address
  );
}

async function openPosition(amount: BigNumber, user: User, direction: Side) {
  await user.clearingHouse.deposit(0, amount.div(100), user.usdc.address); // invest 1 % of the capital
  await user.clearingHouse.openPositionWithUSDC(0, amount.div(100), direction);
}
async function closePosition(user: User) {
  const traderPosition = await user.perpetual.getTraderPosition(user.address);

  let sellAmount;
  if (traderPosition.positionSize.gt(0)) {
    sellAmount = traderPosition.positionSize;
  } else {
    sellAmount = (
      await TEST_get_exactOutputSwap(
        user.market,
        traderPosition.positionSize.abs(),
        ethers.constants.MaxUint256,
        0,
        1
      )
    ).amountIn;
  }

  await user.clearingHouse.closePosition(0, sellAmount);

  const userDeposits = await user.vault.getReserveValue(0, user.address);
  await user.clearingHouse.withdraw(0, userDeposits, user.usdc.address);
}

async function withdrawLiquidity(user: User) {
  const userLpPosition = await user.perpetual.getLpPosition(user.address);
  const providedLiquidity = userLpPosition.liquidityBalance;

  await user.clearingHouse.removeLiquidity(0, providedLiquidity);

  // console.log('**********After withdrawing liquidity**********');
  // await logMarketBalance(user);
  // await logLpPosition(user);
  // await logPerpCRVBalance(user);
  // await logPerpetualBalance(user);
  // await logVaultBalance(user);

  // console.log('**********Close remaining position**********');

  //   await logVaultBalance(user);
  //   await logUserBalance(user, 'LP');
}

async function changeChainlinkOraclePrice(price: BigNumber) {
  const oracle: AggregatorV3Interface = await ethers.getContractAt(
    'AggregatorV3Interface',
    await getChainlinkOracle(env, 'EUR_USD')
  );
  await setLatestChainlinkPrice(env, oracle, price);
}

describe('Increment App: Scenario', function () {
  let deployer: User, trader: User, lp: User;

  let liquidityAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({lp, deployer, trader} = await setup());
    liquidityAmount = await funding();
    await lp.usdc.approve(lp.vault.address, liquidityAmount);
    await trader.usdc.approve(trader.vault.address, liquidityAmount);

    /* important: provide some initial liquidity to the market -> w/o any liquidity left, the market will stop working */
    await deployer.usdc.approve(deployer.vault.address, liquidityAmount);
    await provideLiquidity(liquidityAmount, deployer);
  });

  async function checks() {
    // start: balanceOf(trader) + balanceOf(liquidityProvider) <= end: balanceOf(trader) + balanceOf(liquidityProvider)
    const lpBalanceAfter = await lp.usdc.balanceOf(lp.address);
    const traderBalanceAfter = await trader.usdc.balanceOf(trader.address);

    if (lpBalanceAfter.add(traderBalanceAfter).gt(liquidityAmount.mul(2))) {
      console.log('fails');
    }

    expect(lpBalanceAfter.add(traderBalanceAfter)).to.be.lte(
      liquidityAmount.mul(2)
    );
  }

  describe('One LP & one Trader', async function () {
    describe('1. Should remain solvent with no oracle price change', async function () {
      it('1.1. LP provides liquidity, trader opens long position and closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount, trader, Side.Long);

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('1.2. LP provides liquidity, trader opens long position and closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount, trader, Side.Long);

        await closePosition(trader);

        await withdrawLiquidity(lp);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
    });
    describe('2. EUR/USD increases & long trade', async function () {
      it('2.1. EUR/USD increases, LP provides liquidity, trader opens long position, trader closes position, LP withdraws liquidity', async function () {
        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await provideLiquidity(liquidityAmount, lp);

        await openPosition(liquidityAmount, trader, Side.Long);

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

        await openPosition(liquidityAmount, trader, Side.Long);

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

        await openPosition(liquidityAmount, trader, Side.Long);

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

        await openPosition(liquidityAmount, trader, Side.Long);

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

        await openPosition(liquidityAmount, trader, Side.Short);

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

        await openPosition(liquidityAmount, trader, Side.Short);

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

        await openPosition(liquidityAmount, trader, Side.Short);

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

        await openPosition(liquidityAmount, trader, Side.Short);

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

        await openPosition(liquidityAmount, trader, Side.Long);

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

        await openPosition(liquidityAmount, trader, Side.Long);

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

        await openPosition(liquidityAmount, trader, Side.Long);

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

        await openPosition(liquidityAmount, trader, Side.Long);

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

        await openPosition(liquidityAmount, trader, Side.Short);

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

        await openPosition(liquidityAmount, trader, Side.Short);

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

        await openPosition(liquidityAmount, trader, Side.Short);

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

        await openPosition(liquidityAmount, trader, Side.Short);

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

// async function logMarketBalance(user: User) {
//   console.log(
//     'market has balance of',
//     ethers.utils.formatUnits(
//       await user.vQuote.balanceOf(user.market.address),
//       18
//     ),
//     'vQuote and',
//     ethers.utils.formatUnits(
//       await user.vBase.balanceOf(user.market.address),
//       18
//     ),
//     'vBase'
//   );
// }

// async function logPerpetualBalance(user: User) {
//   console.log(
//     'perpetual has balance of',
//     ethers.utils.formatUnits(
//       await user.vQuote.balanceOf(user.perpetual.address),
//       18
//     ),
//     'vQuote and',
//     ethers.utils.formatUnits(
//       await user.vBase.balanceOf(user.perpetual.address),
//       18
//     ),
//     'vBase'
//   );
// }
// async function logUserBalance(user: User, name: string) {
//   console.log(
//     name,
//     'owns',
//     ethers.utils.formatUnits(
//       await user.usdc.balanceOf(user.address),
//       await user.usdc.decimals()
//     ),
//     'usdc'
//   );
// }

// async function logLpPosition(user: User) {
//   console.log(
//     ' owns: openNotional, positionSize, cumFundingRate, liquidityBalance, profit',
//     (await user.perpetual.getLpPosition(user.address)).toString()
//   );
// }

// async function logVaultBalance(user: User) {
//   console.log(
//     'vault owns',
//     ethers.utils.formatUnits(
//       await user.usdc.balanceOf(user.vault.address),
//       await user.usdc.decimals()
//     ),
//     'usdc'
//   );
// }

// async function logPerpCRVBalance(user: User) {
//   console.log(
//     'perpetual owns',
//     ethers.utils.formatUnits(
//       await user.curveToken.balanceOf(user.perpetual.address),
//       await user.curveToken.decimals()
//     ),
//     'curveToken'
//   );
// }

// async function logMarketPrice(user: User) {
//   console.log(
//     'marketPrice',
//     ethers.utils.formatEther(await user.perpetual.marketPrice()),
//     'indexPrice',
//     ethers.utils.formatEther(await user.perpetual.indexPrice())
//   );
// }
