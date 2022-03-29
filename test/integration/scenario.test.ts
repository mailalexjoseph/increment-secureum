import {expect} from 'chai';
import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';

import {setup, funding, User} from '../helpers/setup';
import {Side} from '../helpers/utils/types';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {
  extendPositionWithCollateral,
  closePosition,
  provideLiquidity,
  withdrawLiquidityAndSettle,
} from '../helpers/PerpetualUtils';
import {changeChainlinkOraclePrice} from '../helpers/ChainlinkUtils';
import {deployJPYUSDMarket} from '../helpers/deployNewMarkets';

// https://docs.chain.link/docs/ethereum-addresses/
const parsePrice = (num: string) => ethers.utils.parseUnits(num, 8);

const EURUSDMarketIdx = 0;
const JPYUSDMarketIdx = 1;

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

  describe('One LP & one Trader (in one market)', async function () {
    describe('1. Should remain solvent with no oracle price change', async function () {
      it('1.1. LP provides liquidity, trader opens long position and closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('1.2. LP provides liquidity, trader opens long position and closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

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

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

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

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('2.3. LP provides liquidity, trader opens long position, EUR/USD increases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('2.4. LP provides liquidity, trader opens long position, trader closes position, EUR/USD increases, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await withdrawLiquidityAndSettle(lp, lp.usdc);

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

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

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

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('3.3. LP provides liquidity, trader opens short position, EUR/USD increases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('3.4. LP provides liquidity, trader opens short position, trader closes position, EUR/USD increases, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1.2'));

        await withdrawLiquidityAndSettle(lp, lp.usdc);

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

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

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

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('4.3. LP provides liquidity, trader opens long position, EUR/USD decreases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('4.4. LP provides liquidity, trader opens long position, trader closes position, EUR/USD decreases, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Long
        );

        await closePosition(trader, trader.usdc);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await withdrawLiquidityAndSettle(lp, lp.usdc);

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

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

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

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
      it('5.3. LP provides liquidity, trader opens short position, EUR/USD decreases, trader closes position, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await closePosition(trader, trader.usdc);

        await withdrawLiquidityAndSettle(lp, lp.usdc);
        // // check results
        // await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });

      it('5.4. LP provides liquidity, trader opens short position, trader closes position, EUR/USD decreases, LP withdraws liquidity', async function () {
        await provideLiquidity(lp, lp.usdc, liquidityAmount);

        await extendPositionWithCollateral(
          trader,
          trader.usdc,
          tradeAmount,
          tradeAmount,
          Side.Short
        );

        await closePosition(trader, trader.usdc);

        // change price
        await changeChainlinkOraclePrice(parsePrice('1'));

        await withdrawLiquidityAndSettle(lp, lp.usdc);

        // check results
        await checks();
        // await logUserBalance(lp, 'lp');
        // await logUserBalance(trader, 'trader');
        // await logVaultBalance(lp);
      });
    });
  });

  describe('LPs & Traders (in multiple markets)', async function () {
    it('Adding a new market (trading pair) succeeds', async function () {
      // EUR_USD (from deploy)
      expect(await deployer.clearingHouse.getNumMarkets()).to.eq(1);

      await deployJPYUSDMarket();

      // EUR_USD + JPY_USD
      expect(await deployer.clearingHouse.getNumMarkets()).to.eq(2);
    });

    it('LP actions in market A do not affect vault balance in market B', async function () {
      // set-up
      await deployJPYUSDMarket();
      await provideLiquidity(
        trader,
        trader.usdc,
        liquidityAmount,
        JPYUSDMarketIdx
      );

      // 1. LP provides liquidity to JYP_USD
      await provideLiquidity(
        lp,
        lp.usdc,
        liquidityAmount.div(2),
        JPYUSDMarketIdx
      );

      // JPY_USD liquidity balance is liquidityAmount/2
      expect(await lp.vault.getLpBalance(JPYUSDMarketIdx, lp.address)).to.eq(
        liquidityAmount.div(2)
      );
      // but EUR_USD balance isn't affected
      expect(await lp.vault.getLpBalance(EURUSDMarketIdx, lp.address)).to.eq(0);

      // 2. LP provides liquidity to JYP_USD pool for a 2nd time
      await provideLiquidity(
        lp,
        lp.usdc,
        liquidityAmount.div(2),
        JPYUSDMarketIdx
      );

      // JPY_USD liquidity balance is liquidityAmount
      expect(await lp.vault.getLpBalance(JPYUSDMarketIdx, lp.address)).to.eq(
        liquidityAmount
      );
      // but EUR_USD balance is still not affected
      expect(await lp.vault.getLpBalance(EURUSDMarketIdx, lp.address)).to.eq(0);

      // 3. LP removes liquidity from JYP_USD
      await withdrawLiquidityAndSettle(lp, lp.usdc, JPYUSDMarketIdx);

      // JPY_USD liquidity balance is now 0
      expect(await lp.vault.getLpBalance(JPYUSDMarketIdx, lp.address)).to.eq(0);
      // but EUR_USD balance is still 0
      expect(await lp.vault.getLpBalance(EURUSDMarketIdx, lp.address)).to.eq(0);
    });

    it('Trader actions in market A do not affect vault balance in market B', async function () {
      // set-up
      await deployJPYUSDMarket();
      await provideLiquidity(lp, lp.usdc, liquidityAmount, JPYUSDMarketIdx);

      // 1. Trader opens position in JYP_USD market with collateral
      await extendPositionWithCollateral(
        trader,
        trader.usdc,
        tradeAmount.div(2), // to avoid price impact error
        tradeAmount.div(2),
        Side.Long,
        JPYUSDMarketIdx
      );

      // trader vault balance in JPY_USD is positive
      expect(
        await trader.vault.getTraderBalance(JPYUSDMarketIdx, trader.address)
      ).to.gt(0);
      // but his EUR_USD vault balance isn't affected
      expect(
        await trader.vault.getTraderBalance(EURUSDMarketIdx, trader.address)
      ).to.eq(0);

      // 2. Trader extends position in JYP_USD market with new collateral
      await extendPositionWithCollateral(
        trader,
        trader.usdc,
        tradeAmount.div(2), // to avoid price impact error
        tradeAmount.div(2),
        Side.Long,
        JPYUSDMarketIdx
      );

      // trader vault balance in JPY_USD is still positive
      expect(
        await trader.vault.getTraderBalance(JPYUSDMarketIdx, trader.address)
      ).to.gt(0);
      // but his EUR_USD vault balance is still not affected
      expect(
        await trader.vault.getTraderBalance(EURUSDMarketIdx, trader.address)
      ).to.eq(0);

      // 3. Trader closes position
      await closePosition(trader, trader.usdc, JPYUSDMarketIdx);

      // trader vault balance in JPY_USD is now 0
      expect(
        await trader.vault.getTraderBalance(JPYUSDMarketIdx, trader.address)
      ).to.eq(0);
      // but his EUR_USD vault balance is still 0
      expect(
        await trader.vault.getTraderBalance(EURUSDMarketIdx, trader.address)
      ).to.eq(0);
    });

    it('Extending position on any market increases the insurance fee in the same way', async function () {
      // set-up
      await deployJPYUSDMarket();
      await provideLiquidity(lp, lp.usdc, liquidityAmount, JPYUSDMarketIdx);

      // initial insurance fee
      expect(
        await trader.vault.getTraderBalance(0, deployer.clearingHouse.address)
      ).to.eq(0);

      // 1. Trader opens position in JYP_USD market with collateral
      await extendPositionWithCollateral(
        trader,
        trader.usdc,
        tradeAmount.div(2),
        tradeAmount.div(2),
        Side.Long,
        JPYUSDMarketIdx
      );

      // insurance fee after trade of tradeAmount volume in JYP_USD
      const insuranceFeeAfterJPYUSDTrade = await trader.vault.getTraderBalance(
        0,
        deployer.clearingHouse.address
      );

      await extendPositionWithCollateral(
        trader,
        trader.usdc,
        tradeAmount.div(2),
        tradeAmount.div(2),
        Side.Long,
        EURUSDMarketIdx
      );

      const insuranceFeeAfterEURUSDTrade = await trader.vault.getTraderBalance(
        0,
        deployer.clearingHouse.address
      );

      expect(insuranceFeeAfterEURUSDTrade).to.eq(
        insuranceFeeAfterJPYUSDTrade.mul(2)
      );
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
