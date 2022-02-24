import {ethers, getNamedAccounts} from 'hardhat';
import {BigNumber} from 'ethers';
import env = require('hardhat');

import {funding, getContracts, User} from '../test/helpers/setup';
import {Side} from '../test/helpers/utils/types';
import {setLatestChainlinkPrice} from '../test/helpers/utils/manipulateStorage';
import {setupUsers} from '../helpers/misc-utils';
import {getChainlinkOracle} from '../helpers/contracts-getters';
import {TEST_get_exactOutputSwap} from '../test/helpers/CurveUtils';
import {AggregatorV3Interface} from '../typechain';
import {tokenToWad} from '../helpers/contracts-helpers';

const parsePrice = (num: string) => ethers.utils.parseUnits(num, 8);

async function provideLiquidity(liquidityAmount: BigNumber, user: User) {
  await user.clearingHouse.provideLiquidity(
    0,
    liquidityAmount,
    user.usdc.address
  );
}

async function openPosition(amount: BigNumber, user: User, direction: Side) {
  await user.clearingHouse.deposit(0, amount.div(100), user.usdc.address);
  await user.clearingHouse.openPosition(0, amount.div(100), direction, 0); // 10x leverage long
}

async function closePosition(user: User, trader: User) {
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

  await user.clearingHouse.closePosition(0, sellAmount, 0);

  const userDeposits = await user.vault.getReserveValue(0, user.address);
  await user.clearingHouse.withdraw(0, userDeposits, user.usdc.address);
}

async function withdrawLiquidity(user: User) {
  const userLpPosition = await user.perpetual.getLpPosition(user.address);
  const providedLiquidity = userLpPosition.liquidityBalance;

  await user.clearingHouse.removeLiquidity(0, providedLiquidity);
}

async function changeOraclePrice(
  oracle: AggregatorV3Interface,
  price: BigNumber
) {
  await setLatestChainlinkPrice(env, oracle, price);
}

const main = async function () {
  // Setup
  const oracle = <AggregatorV3Interface>(
    await ethers.getContractAt(
      'AggregatorV3Interface',
      getChainlinkOracle(env, 'EUR_USD')
    )
  );
  const users = await getNamedAccounts();

  const contracts = await getContracts(users.deployer);
  const [deployer, bob, alice, trader, lp, user] = await setupUsers(
    Object.values(users),
    contracts
  );

  const liquidityAmountUSDC = await funding();

  const liquidityAmount = await tokenToWad(
    await alice.vault.getReserveTokenDecimals(),
    liquidityAmountUSDC
  );

  await lp.usdc.approve(lp.vault.address, liquidityAmountUSDC);
  await deployer.usdc.approve(deployer.vault.address, liquidityAmountUSDC);
  await trader.usdc.approve(trader.vault.address, liquidityAmountUSDC);

  await provideLiquidity(liquidityAmountUSDC, deployer);

  // Scenario
  await provideLiquidity(liquidityAmountUSDC, lp);

  await openPosition(liquidityAmount.div(10), trader, Side.Long);

  // change price
  await changeOraclePrice(oracle, parsePrice('1.2'));

  await closePosition(trader, trader);

  await withdrawLiquidity(lp);
};

main();
