import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import env = require('hardhat');

import {fundAccountWithUSDC} from './utils/manipulateStorage';
// helpers
import {getReserveAddress} from '../../helpers/contract-getters';
import {
  setupUser,
  setupUsers,
  logDeployments,
  getEthereumNetworkFromHRE,
} from '../../helpers/misc-utils';
import {convertToCurrencyDecimals} from '../../helpers/contracts-helpers';

// types
import {
  ERC20,
  ChainlinkOracle,
  ChainlinkTWAPOracle,
  PoolTWAPOracle,
  TestPerpetual,
  Vault,
  VirtualToken,
} from '../../typechain';
import {BigNumber} from '../../helpers/types';
import {CryptoSwap} from '../../contracts-vyper/typechain/CryptoSwap';
import {CurveTokenV5} from '../../contracts-vyper/typechain/CurveTokenV5';

export type User = {address: string} & {
  perpetual: TestPerpetual;
  vault: Vault;
  usdc: ERC20;
  vBase: VirtualToken;
  vQuote: VirtualToken;
  market: CryptoSwap;
  chainlinkOracle: ChainlinkOracle;
  chainlinkTWAPOracle: ChainlinkTWAPOracle;
  poolTWAPOracle: PoolTWAPOracle;
  curve: CurveTokenV5;
};

export interface TestEnv {
  deployer: User;
  user: User;
  bob: User;
  alice: User;
  trader: User;
  lp: User;
  users: User[];
}

/// @notice: get all deployed contracts
const getContracts = async (deply: string) => {
  const usdcAddress = getReserveAddress('USDC', getEthereumNetworkFromHRE(env));

  return {
    vBase: <VirtualToken>await ethers.getContract('VBase', deply),
    vQuote: <VirtualToken>await ethers.getContract('VQuote', deply),
    market: <CryptoSwap>await ethers.getContract('CryptoSwap', deply),
    vault: <Vault>await ethers.getContract('Vault', deply),
    perpetual: <TestPerpetual>await ethers.getContract('TestPerpetual', deply),
    usdc: <ERC20>await ethers.getContractAt('ERC20', usdcAddress, deply),
    curve: <CurveTokenV5>await ethers.getContract('CurveTokenV5', deply),
    chainlinkOracle: <ChainlinkOracle>(
      await ethers.getContract('ChainlinkOracle', deply)
    ),
    chainlinkTWAPOracle: <ChainlinkTWAPOracle>(
      await ethers.getContract('ChainlinkTWAPOracle', deply)
    ),
    poolTWAPOracle: <PoolTWAPOracle>(
      await ethers.getContract('PoolTWAPOracle', deply)
    ),
  };
};

async function _fundAccount(account: string): Promise<BigNumber> {
  const {usdc} = await getContracts(account);
  const fullAmount = await convertToCurrencyDecimals(usdc, '100');
  await fundAccountWithUSDC(env, usdc, account, fullAmount);
  return fullAmount;
}
/// @notice: fund user accounts
export const funding = deployments.createFixture(async () => {
  const {deployer, bob, alice, user, trader, lp} = await getNamedAccounts();

  await _fundAccount(deployer);
  await _fundAccount(bob);
  await _fundAccount(alice);
  await _fundAccount(trader);
  await _fundAccount(lp);
  return await _fundAccount(user);
});

/// @notice: Main deployment function
export const setup = deployments.createFixture(async (): Promise<TestEnv> => {
  // get contracts
  await deployments.fixture('UpdateReferencesToPerpetual');

  await logDeployments();
  const {deployer, bob, alice, user, trader, lp} = await getNamedAccounts();
  const contracts = await getContracts(deployer);

  // container
  const testEnv: TestEnv = {} as TestEnv;

  testEnv.deployer = await setupUser(deployer, contracts);
  testEnv.user = await setupUser(user, contracts);
  testEnv.bob = await setupUser(bob, contracts);
  testEnv.alice = await setupUser(alice, contracts);
  testEnv.trader = await setupUser(trader, contracts);
  testEnv.lp = await setupUser(lp, contracts);
  testEnv.users = await setupUsers(await getUnnamedAccounts(), contracts);

  return testEnv;
});
