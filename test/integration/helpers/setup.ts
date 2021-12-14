import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import env = require('hardhat');

// helpers
import {getReserveAddress} from '../../../helpers/contract-getters';
import {
  setupUser,
  setupUsers,
  logDeployments,
  impersonateAccountsHardhat,
  getEthereumNetworkFromHRE,
} from '../../../helpers/misc-utils';
import {convertToCurrencyDecimals} from '../../../helpers/contracts-helpers';

// types
import {
  ERC20,
  ICryptoSwap,
  Oracle,
  Perpetual,
  Vault,
  VirtualToken,
} from '../../../typechain';
import {BigNumber, tEthereumAddress} from '../../../helpers/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

import {getWhale} from './utils';

import {CURVE_FACTORY_MAINNET} from '../../../markets/ethereum';
import curveFactoryAbi from '../../../contracts/dependencies/curve-factory-v2.json';
import curveSwapAbi from '../../../contracts/dependencies/curve-swap-v2.json';

export type User = {address: string} & {
  perpetual: Perpetual;
  vault: Vault;
  usdc: ERC20;
  vEUR: VirtualToken;
  vUSD: VirtualToken;
  market: ICryptoSwap;
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

  const curveFactory = await ethers.getContractAt(
    curveFactoryAbi,
    CURVE_FACTORY_MAINNET,
    deployerAccount
  );
  const VEURVUSDPoolAddress = await curveFactory[
    'find_pool_for_coins(address,address)'
  ](vEUR.address, vUSD.address);

  return {
    vEUR,
    vUSD,
    market: <ICryptoSwap>(
      await ethers.getContractAt(
        curveSwapAbi,
        VEURVUSDPoolAddress,
        deployerAccount
      )
    ),
    oracle: <Oracle>await ethers.getContract('Oracle', deployerAccount),
    vault: <Vault>await ethers.getContract('Vault', deployerAccount),
    perpetual: <Perpetual>(
      await ethers.getContract('Perpetual', deployerAccount)
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

/// @notice: steal funds from whale adress
async function stealFunds(
  token: ERC20,
  newHolder: tEthereumAddress,
  balance: BigNumber,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const whaleAddress = await getWhale(token, balance);
  await impersonateAccountsHardhat([whaleAddress], hre);
  const whale = await setupUser(whaleAddress, {token: token});
  whale.token.transfer(newHolder, balance);
}

async function _fundAcount(account: string): Promise<BigNumber> {
  const {usdc} = await getContracts(account);
  const fullAmount = await convertToCurrencyDecimals(usdc, '100');
  await stealFunds(usdc, account, fullAmount, env);
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
