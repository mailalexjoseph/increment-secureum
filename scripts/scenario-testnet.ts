import {ethers, getNamedAccounts} from 'hardhat';

import {convertToCurrencyDecimals} from '../helpers/contracts-helpers';
import {Side} from '../test/helpers/utils/types';
import {setupUsers} from '../helpers/misc-utils';
import {tokenToWad} from '../helpers/contracts-helpers';
import {
  extendPositionWithCollateral,
  closePosition,
  provideLiquidity,
  withdrawLiquidity,
  withdrawCollateral,
} from '../test/helpers/PerpetualUtils';
import env = require('hardhat');

import {
  VirtualToken,
  Vault,
  Perpetual,
  Insurance,
  USDCmock,
  IERC20,
  ClearingHouse,
  ClearingHouseViewer,
} from '../typechain';

import {
  CurveCryptoSwapTest,
  CurveTokenV5Test,
} from '../contracts-vyper/typechain';

import {User} from '../test/helpers/setup';
import {asBigNumber} from '../test/helpers/utils/calculations';
import {BigNumber, tEthereumAddress} from '../helpers/types';

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
    usdc: <IERC20>await ethers.getContract('USDCmock', deployAccount),
    clearingHouse: <ClearingHouse>(
      await ethers.getContract('ClearingHouse', deployAccount)
    ),
    clearingHouseViewer: <ClearingHouseViewer>(
      await ethers.getContract('ClearingHouseViewer', deployAccount)
    ),
  };
};

async function fundAccounts(
  user: User,
  amount: BigNumber,
  accounts: tEthereumAddress[]
) {
  console.log('Fund accounts');
  const usdcMock = await (<USDCmock>user.usdc);
  if ((await usdcMock.owner()) !== user.address) {
    throw 'User can not mint tokens';
  }

  for (const account of accounts) {
    await (await usdcMock.mint(account, amount)).wait();
  }
}

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

  const usdcMock = await (<USDCmock>deployer.usdc);
  if ((await usdcMock.owner()) === deployer.address) {
    await fundAccounts(deployer, asBigNumber('1000'), [
      deployer.address,
      user.address,
    ]);
  }

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
  await extendPositionWithCollateral(
    deployer,
    deployer.usdc,
    liquidityAmount.div(100),
    liquidityAmount.div(100),
    Side.Long
  );

  // open short position
  await closeExistingPosition(user);
  await extendPositionWithCollateral(
    user,
    user.usdc,
    liquidityAmount.div(200),
    liquidityAmount.div(50),
    Side.Short
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
