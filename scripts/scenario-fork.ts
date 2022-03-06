import {ethers, getNamedAccounts} from 'hardhat';
import {BigNumber} from 'ethers';
import env = require('hardhat');

import {funding, getContracts} from '../test/helpers/setup';
import {Side} from '../test/helpers/utils/types';
import {setLatestChainlinkPrice} from '../test/helpers/utils/manipulateStorage';
import {setupUsers} from '../helpers/misc-utils';
import {getChainlinkOracle} from '../helpers/contracts-getters';
import {AggregatorV3Interface} from '../typechain';
import {tokenToWad} from '../helpers/contracts-helpers';
import {
  extendPositionWithCollateral,
  reducePosition,
  provideLiquidity,
  withdrawLiquidity,
} from '../test/helpers/PerpetualUtils';

const parsePrice = (num: string) => ethers.utils.parseUnits(num, 8);

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
  const [deployer, alice, trader, lp] = await setupUsers(
    Object.values(users),
    contracts
  );

  const liquidityAmountUSDC = await funding();
  const liquidityAmount = await tokenToWad(
    await alice.vault.getReserveTokenDecimals(),
    liquidityAmountUSDC
  );

  await provideLiquidity(deployer, deployer.usdc, liquidityAmount);

  // Scenario
  await provideLiquidity(lp, lp.usdc, liquidityAmount);

  await extendPositionWithCollateral(
    trader,
    trader.usdc,
    liquidityAmount.div(10),
    liquidityAmount.div(10),
    Side.Long
  );

  // change price
  await changeOraclePrice(oracle, parsePrice('1.2'));

  await reducePosition(trader, trader.usdc);

  await withdrawLiquidity(lp, lp.usdc);
};

main();
