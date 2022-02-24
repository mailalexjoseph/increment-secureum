import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import env = require('hardhat');

// helpers
import {
  getReserveAddress,
  getCryptoSwap,
  getCryptoSwapFactory,
  getCurveToken,
} from '../../helpers/contracts-getters';
import {setupUser, setupUsers, logDeployments} from '../../helpers/misc-utils';
import {convertToCurrencyDecimals} from '../../helpers/contracts-helpers';
import {setUSDCBalance} from './utils/manipulateStorage';

// types
import {
  ERC20,
  ChainlinkOracle,
  ChainlinkTWAPOracle,
  PoolTWAPOracle,
  TestPerpetual,
  Vault,
  VirtualToken,
  Insurance,
  ClearingHouse,
} from '../../typechain';

import {BigNumber} from '../../helpers/types';
import {
  CurveCryptoSwap2ETH,
  CurveTokenV5,
  Factory,
} from '../../contracts-vyper/typechain';

export type User = {address: string} & {
  perpetual: TestPerpetual;
  vault: Vault;
  usdc: ERC20;
  vBase: VirtualToken;
  vQuote: VirtualToken;
  market: CurveCryptoSwap2ETH;
  clearingHouse: ClearingHouse;
  insurance: Insurance;
  factory: Factory;
  chainlinkOracle: ChainlinkOracle;
  chainlinkTWAPOracle: ChainlinkTWAPOracle;
  poolTWAPOracle: PoolTWAPOracle;
  curveToken: CurveTokenV5;
};

export interface TestEnv {
  deployer: User;
  user: User;
  bob: User;
  alice: User;
  trader: User;
  traderTwo: User;
  lp: User;
  lpTwo: User;
  users: User[];
}

/// @notice: get all deployed contracts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getContracts = async (deployAccount: string): Promise<any> => {
  const usdcAddress = getReserveAddress('USDC', env);

  const factory = await getCryptoSwapFactory(env);
  const cryptoswap = await getCryptoSwap(factory);

  return {
    factory: <Factory>factory,
    market: <CurveCryptoSwap2ETH>cryptoswap,
    curveToken: <CurveTokenV5>await getCurveToken(cryptoswap),

    vBase: <VirtualToken>await ethers.getContract('VBase', deployAccount),
    vQuote: <VirtualToken>await ethers.getContract('VQuote', deployAccount),
    vault: <Vault>await ethers.getContract('Vault', deployAccount),
    perpetual: <TestPerpetual>(
      await ethers.getContract('TestPerpetual', deployAccount)
    ),
    insurance: <Insurance>await ethers.getContract('Insurance', deployAccount),
    usdc: <ERC20>(
      await ethers.getContractAt('ERC20', usdcAddress, deployAccount)
    ),
    clearingHouse: <ClearingHouse>(
      await ethers.getContract('ClearingHouse', deployAccount)
    ),
    chainlinkOracle: <ChainlinkOracle>(
      await ethers.getContract('ChainlinkOracle', deployAccount)
    ),
    chainlinkTWAPOracle: <ChainlinkTWAPOracle>(
      await ethers.getContract('ChainlinkTWAPOracle', deployAccount)
    ),
    poolTWAPOracle: <PoolTWAPOracle>(
      await ethers.getContract('PoolTWAPOracle', deployAccount)
    ),
  };
};

async function _fundAccount(account: string): Promise<BigNumber> {
  const {usdc} = await getContracts(account);
  const fullAmount = await convertToCurrencyDecimals(usdc, '100');
  await setUSDCBalance(env, usdc, account, fullAmount);
  return fullAmount;
}

/// @notice: fund user accounts
export const funding = deployments.createFixture(async () => {
  const {deployer, bob, alice, user, trader, traderTwo, lp, lpTwo} =
    await getNamedAccounts();

  await _fundAccount(deployer);
  await _fundAccount(bob);
  await _fundAccount(alice);
  await _fundAccount(trader);
  await _fundAccount(traderTwo);
  await _fundAccount(lp);
  await _fundAccount(lpTwo);
  return await _fundAccount(user);
});

/// @notice: Main deployment function
export const setup = deployments.createFixture(async (): Promise<TestEnv> => {
  // get contracts
  await deployments.fixture('UpdateReferencesToPerpetual');

  await logDeployments();
  const {deployer, bob, alice, user, trader, traderTwo, lp, lpTwo} =
    await getNamedAccounts();
  const contracts = await getContracts(deployer);

  // container
  const testEnv: TestEnv = {} as TestEnv;

  testEnv.deployer = await setupUser(deployer, contracts);
  testEnv.user = await setupUser(user, contracts);
  testEnv.bob = await setupUser(bob, contracts);
  testEnv.alice = await setupUser(alice, contracts);
  testEnv.trader = await setupUser(trader, contracts);
  testEnv.traderTwo = await setupUser(traderTwo, contracts);
  testEnv.lp = await setupUser(lp, contracts);
  testEnv.lpTwo = await setupUser(lpTwo, contracts);
  testEnv.users = await setupUsers(await getUnnamedAccounts(), contracts);

  return testEnv;
});
