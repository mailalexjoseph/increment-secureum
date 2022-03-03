import {expect} from 'chai';
import {ethers} from 'hardhat';
import {setup, funding, User} from '../helpers/setup';

import {BigNumber} from 'ethers';
import {Side} from '../helpers/utils/types';
import {tokenToWad} from '../../helpers/contracts-helpers';

import {
  openPosition,
  closePosition,
  provideLiquidity,
  withdrawLiquidity,
} from '../helpers/PerpetualUtils';
import {changeChainlinkOraclePrice} from '../helpers/ChainlinkUtils';

// https://docs.chain.link/docs/ethereum-addresses/
const parsePrice = (num: string) => ethers.utils.parseUnits(num, 8);

describe('Increment App: Scenario', function () {
  let deployer: User, trader: User, lp: User;

  let liquidityAmountUSDC: BigNumber;
  let liquidityAmount: BigNumber;
  let tradeAmount: BigNumber;

  beforeEach('Set up', async () => {
    ({lp, deployer, trader} = await setup());
    liquidityAmountUSDC = await funding();
    liquidityAmount = await tokenToWad(6, liquidityAmountUSDC);
    tradeAmount = liquidityAmount.div(20); // trade 5% of liquidity
    /* important: provide some initial liquidity to the market -> w/o any liquidity left, the market will stop working */
    await provideLiquidity(deployer, deployer.usdc, liquidityAmount);
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
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('1.2. LP provides liquidity, trader opens long position and closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

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

        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('2.2. LP provides liquidity, EUR/USD increases, trader opens long position, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('2.3. LP provides liquidity, trader opens long position, EUR/USD increases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('2.4. LP provides liquidity, trader opens long position, trader closes position, EUR/USD increases, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await withdrawLiquidity(lp, lp.usdc);

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

        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('3.2. LP provides liquidity, EUR/USD increases, trader opens short position, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('3.3. LP provides liquidity, trader opens short position, EUR/USD increases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('3.4. LP provides liquidity, trader opens short position, trader closes position, EUR/USD increases, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await withdrawLiquidity(lp, lp.usdc);

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

        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('4.2. LP provides liquidity, EUR/USD decreases, trader opens long position, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('4.3. LP provides liquidity, trader opens long position, EUR/USD decreases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('4.4. LP provides liquidity, trader opens long position, trader closes position, EUR/USD decreases, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await withdrawLiquidity(lp, lp.usdc);

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

        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('5.2. LP provides liquidity, EUR/USD decreases, trader opens short position, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('5.3. LP provides liquidity, trader opens short position, EUR/USD decreases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await closePosition(trader, trader.usdc);

        await withdrawLiquidity(lp, lp.usdc);
        // // check results
        // await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('5.4. LP provides liquidity, trader opens short position, trader closes position, EUR/USD decreases, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await openPosition(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await withdrawLiquidity(lp, lp.usdc);

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
//       await trader.usdc.balanceOf(user.address),
//       await trader.usdc.decimals()
//     ),
//     'usdc'
//   );
// }

// async function logLpPosition(user: User) {
//   console.log(
//     ' owns: openNotional, positionSize, weightedTradePremium, liquidityBalance, profit',
//     (await user.perpetual.getLpPosition(user.address)).toString()
//   );
// }

// async function logVaultBalance(user: User) {
//   console.log(
//     'vault owns',
//     ethers.utils.formatUnits(
//       await trader.usdc.balanceOf(user.vault.address),
//       await trader.usdc.decimals()
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
