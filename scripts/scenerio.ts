import {ethers, getNamedAccounts} from 'hardhat';
import {BigNumber} from 'ethers';
import env = require('hardhat');

import {funding, getContracts, User} from '../test/integration/helpers/setup';
import {Side} from '../test/integration/helpers/utils/types';
import {setLatestChainlinkPrice} from '../test/integration/helpers/utils/manipulateStorage';
import {setupUsers} from '../helpers/misc-utils';
import {getChainlinkOracle} from '../helpers/contracts-deployments';
import {AggregatorV3Interface} from '../typechain';

const parsePrice = (num: string) => ethers.utils.parseUnits(num, 8);

async function provideLiquidity(liquidityAmount: BigNumber, user: User) {
  await user.perpetual.provideLiquidity(liquidityAmount, user.usdc.address);
}

async function openPosition(amount: BigNumber, user: User, direction: Side) {
  await user.perpetual.deposit(amount, user.usdc.address);
  await user.perpetual.openPosition(amount.mul(10), direction); // 10x leverage long
}

async function closePosition(user: User, trader: User) {
  await user.perpetual.closePosition();
  const traderDeposits = await trader.vault.getReserveValue(trader.address);
  await user.perpetual.withdraw(traderDeposits, user.usdc.address);
}

async function withdrawLiquidity(user: User) {
  const providedLiquidity = (
    await user.perpetual.liquidityPosition(user.address)
  )[0];

  await user.perpetual.withdrawLiquidity(providedLiquidity, user.usdc.address);
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

  const liquidityAmount = await funding();

  await lp.usdc.approve(lp.vault.address, liquidityAmount);
  await deployer.usdc.approve(deployer.vault.address, liquidityAmount);
  await trader.usdc.approve(trader.vault.address, liquidityAmount);

  await provideLiquidity(liquidityAmount, deployer);

  // Scenerio
  await provideLiquidity(liquidityAmount, lp);

  await openPosition(liquidityAmount.div(10), trader, Side.Long);

  // change price
  await changeOraclePrice(oracle, parsePrice('1.2'));

  await closePosition(trader, trader);

  await withdrawLiquidity(lp);
};

main();
