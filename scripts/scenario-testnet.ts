import {ethers, getNamedAccounts} from 'hardhat';

import {convertToCurrencyDecimals} from '../../helpers/contracts-helpers';
import {Side} from '../../test/helpers/utils/types';
import {setupUsers} from '../../helpers/misc-utils';
import {tokenToWad} from '../../helpers/contracts-helpers';
import {
  openPosition,
  closePosition,
  provideLiquidity,
  withdrawLiquidity,
  withdrawCollateral,
} from '../../test/helpers/PerpetualUtils';
import env = require('hardhat');

import {
  VirtualToken,
  Vault,
  Perpetual,
  Insurance,
  ERC20,
  ClearingHouse,
} from '../../typechain';

import {
  CurveCryptoSwapTest,
  CurveTokenV5Test,
} from '../../contracts-vyper/typechain';

import {User} from '../../test/helpers/setup';
import {asBigNumber} from '../../test/helpers/utils/calculations';

const getContractsKovan = async (deployAccount: string): Promise<any> => {
  return {
    market: <CurveCryptoSwapTest>(
      await ethers.getContract('CurveCryptoSwapTest', deployAccount)
    ),
    curveToken: <CurveTokenV5Test>(
      await ethers.getContract('CurveTokenV5Test', deployAccount)
    ),
    vBase: <VirtualToken>await ethers.getContract('VBase', deployAccount),
    vQuote: <VirtualToken>await ethers.getContract('VQuote', deployAccount),
    vault: <Vault>await ethers.getContract('Vault', deployAccount),
    perpetual: <Perpetual>await ethers.getContract('Perpetual', deployAccount),
    insurance: <Insurance>await ethers.getContract('Insurance', deployAccount),
    usdc: <ERC20>await ethers.getContract('USDCmock', deployAccount),
    clearingHouse: <ClearingHouse>(
      await ethers.getContract('ClearingHouse', deployAccount)
    ),
  };
};

async function closeExistingPosition(user: User) {
  // We force traders / lps to close their position before opening a new one
  const traderPosition = await user.clearingHouse.getTraderPosition(
    0,
    user.address
  );
  if (
    !traderPosition.positionSize.isZero() ||
    !traderPosition.openNotional.isZero()
  ) {
    console.log('Closing existing position');
    await closePosition(user, user.usdc);
  }
  const reserveValue = await user.clearingHouse.getReserveValue(
    0,
    user.address
  );
  if (!reserveValue.isZero()) {
    console.log('Withdraw remaining collateral');
    await withdrawCollateral(user, user.usdc);
  }
}

async function withdrawExistingLiquidity(user: User) {
  // We force traders / lps to close their position before opening a new one
  const liquidityPosition = await user.perpetual.getLpPosition(user.address);
  if (
    !liquidityPosition.positionSize.isZero() ||
    !liquidityPosition.openNotional.isZero() ||
    !liquidityPosition.liquidityBalance.isZero()
  ) {
    console.log('Withdraw available liquidity');
    await withdrawLiquidity(user, user.usdc);
  }
  const reserveValue = await user.clearingHouse.getReserveValue(
    0,
    user.address
  );
  if (!reserveValue.isZero()) {
    console.log('Withdraw remaining collateral');
    await withdrawCollateral(user, user.usdc);
  }
}

const main = async function () {
  console.log(`Current network is ${env.network.name.toString()}`);

  if (env.network.name !== 'kovan') {
    throw new Error('Run script on network kovan');
  }

  // Setup
  const users = await getNamedAccounts();

  const contracts = await getContractsKovan(users.deployer);
  const [deployer, user] = await setupUsers(Object.values(users), contracts);

  // liquidity amount
  const liquidityAmountUSDC = await convertToCurrencyDecimals(
    contracts.usdc,
    '100'
  );
  const liquidityAmount = await tokenToWad(
    await deployer.usdc.decimals(),
    liquidityAmountUSDC
  );

  // Scenario

  /* initial liquidity */
  if ((await deployer.curveToken.totalSupply()).isZero()) {
    console.log('Provide initial liquidity');
    await provideLiquidity(user, user.usdc, asBigNumber('5000'));
  }

  // provide liquidity: TODO fix bugs
  // await withdrawExistingLiquidity(deployer);
  // await provideLiquidity(deployer, deployer.usdc, liquidityAmount);

  // open long position
  await closeExistingPosition(deployer);
  await openPosition(
    deployer,
    deployer.usdc,
    liquidityAmount.div(100),
    liquidityAmount.div(100),
    Side.Long
  );

  // open short position
  await closeExistingPosition(user);
  await openPosition(
    user,
    user.usdc,
    liquidityAmount.div(200),
    liquidityAmount.div(50),
    Side.Short
  );
};

main();
