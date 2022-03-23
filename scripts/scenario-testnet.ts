import {ethers, getNamedAccounts} from 'hardhat';

import {Side} from '../test/helpers/utils/types';
import {setupUsers} from '../helpers/misc-utils';
import {tokenToWad} from '../helpers/contracts-helpers';
import {
  extendPositionWithCollateral,
  closePosition,
  provideLiquidity,
  withdrawLiquidityAndSettle,
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  amount: BigNumber, // 18 decimals precision
  accounts: tEthereumAddress[]
) {
  const usdcMock = await (<USDCmock>user.usdc);
  if ((await usdcMock.owner()) !== user.address) {
    throw 'User can not mint tokens';
  }
  const tokenAmount = await tokenToWad(await user.usdc.decimals(), amount);

  for (const account of accounts) {
    await (await usdcMock.mint(account, tokenAmount)).wait();
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function closeExistingPosition(user: User) {
  // We force traders / lps to close their position before opening a new one
  const traderPosition = await user.clearingHouseViewer.getTraderPosition(
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
  const reserveValue = await user.clearingHouseViewer.getTraderReserveValue(
    0,
    user.address
  );
  if (!reserveValue.isZero()) {
    console.log(
      'Withdraw remaining collateral of ' +
        ethers.utils.formatEther(reserveValue)
    );
    await withdrawCollateral(user, user.usdc);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function withdrawExistingLiquidity(user: User) {
  // We force traders / lps to close their position before opening a new one
  const liquidityPosition = await user.perpetual.getLpPosition(user.address);
  if (!liquidityPosition.liquidityBalance.isZero()) {
    console.log('Withdraw available liquidity and settle');
    await withdrawLiquidityAndSettle(user, user.usdc);
  } else {
    console.log('No liquidity to withdraw');
  }
}

const main = async function () {
  if (env.network.name !== 'kovan') {
    throw new Error(
      'Run script on network kovan (via appending --network kovan)'
    );
  }

  // Setup
  const users = await getNamedAccounts();
  const contracts = await getContractsKovan(users.deployer);
  const [deployer, user, liquidator, frontend, backend, tester] =
    await setupUsers(Object.values(users), contracts);

  // Scenario
  const tradeSize = asBigNumber('100');

  /* provide initial liquidity */
  if ((await deployer.curveToken.totalSupply()).isZero()) {
    console.log('Fund accounts');
    const usdcMock = <USDCmock>deployer.usdc;
    if ((await usdcMock.owner()) === deployer.address) {
      await fundAccounts(deployer, asBigNumber('100000'), [
        deployer.address,
        user.address,
        liquidator.address,
        frontend.address,
        backend.address,
        tester.address,
      ]);
    }
    console.log('Provide initial liquidity');
    await provideLiquidity(deployer, deployer.usdc, asBigNumber('100000'));
  }

  /* open short position */
  await closeExistingPosition(user);
  await extendPositionWithCollateral(
    user,
    user.usdc,
    tradeSize,
    tradeSize.mul(10),
    Side.Short
  );

  /* open long position */
  await closeExistingPosition(user);
  await extendPositionWithCollateral(
    user,
    user.usdc,
    tradeSize,
    tradeSize.mul(10),
    Side.Short
  );
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
