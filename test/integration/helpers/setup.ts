import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import env = require('hardhat');

import {fundAccountWithUSDC} from './utils/changeBalance';
// helpers
import {getReserveAddress} from '../../../helpers/contract-getters';
import {
  setupUser,
  setupUsers,
  logDeployments,
  getEthereumNetworkFromHRE,
} from '../../../helpers/misc-utils';
import {convertToCurrencyDecimals} from '../../../helpers/contracts-helpers';

// types
import {
  ERC20,
  Oracle,
  TestPerpetual,
  Vault,
  VirtualToken,
} from '../../../typechain';
import {BigNumber} from '../../../helpers/types';
import {CryptoSwap} from '../../../contracts-vyper/typechain/CryptoSwap';

export type User = {address: string} & {
  perpetual: TestPerpetual;
  vault: Vault;
  usdc: ERC20;
  vEUR: VirtualToken;
  vUSD: VirtualToken;
  market: CryptoSwap;
  oracle: Oracle;
};

export interface TestEnv {
  deployer: User;
  user: User;
  bob: User;
  alice: User;
  users: User[];
}

/// @notice: get all deployed contracts
const getContracts = async (deployerAccount: string) => {
  const vEUR = <VirtualToken>await ethers.getContract('VBase', deployerAccount);
  const vUSD = <VirtualToken>(
    await ethers.getContract('VQuote', deployerAccount)
  );

  return {
    vEUR,
    vUSD,
    market: <CryptoSwap>await ethers.getContract('CryptoSwap', deployerAccount),
    oracle: <Oracle>await ethers.getContract('Oracle', deployerAccount),
    vault: <Vault>await ethers.getContract('Vault', deployerAccount),
    perpetual: <TestPerpetual>(
      await ethers.getContract('TestPerpetual', deployerAccount)
    ),
    usdc: <ERC20>(
      await ethers.getContractAt(
        'ERC20',
        getReserveAddress('USDC', getEthereumNetworkFromHRE(env)),
        deployerAccount
      )
    ),
  };
};

async function _fundAcount(account: string): Promise<BigNumber> {
  const {usdc} = await getContracts(account);
  const fullAmount = await convertToCurrencyDecimals(usdc, '100');
  await fundAccountWithUSDC(env, usdc, account, fullAmount);
  return fullAmount;
}
/// @notice: fund user accounts
export const funding = deployments.createFixture(async () => {
  const {bob, alice, user} = await getNamedAccounts();
  await _fundAcount(bob);
  await _fundAcount(alice);
  return await _fundAcount(user);
});

/// @notice: Main deployment function
export const setup = deployments.createFixture(async (): Promise<TestEnv> => {
  // get contracts
  await deployments.fixture();
  await logDeployments();
  const {deployer, bob, alice, user} = await getNamedAccounts();
  const contracts = await getContracts(deployer);

  // container
  const testEnv: TestEnv = {} as TestEnv;

  testEnv.deployer = await setupUser(deployer, contracts);
  testEnv.user = await setupUser(user, contracts);
  testEnv.bob = await setupUser(bob, contracts);
  testEnv.alice = await setupUser(alice, contracts);
  testEnv.users = await setupUsers(await getUnnamedAccounts(), contracts);

  return testEnv;
});
