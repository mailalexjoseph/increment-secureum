import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import env = require('hardhat');

// helpers
import {getReserveAddress, getVAMMConfig} from '../../helpers/contract-getters';
import {
  setupUser,
  setupUsers,
  logDeployments,
  impersonateAccountsHardhat,
  getEthereumNetworkFromHRE,
} from '../../helpers/misc-utils';
import {convertToCurrencyDecimals} from '../../helpers/contracts-helpers';

// types
import {Perpetual, Vault, ERC20} from '../../typechain';
import {BigNumber, tEthereumAddress, iVAMMConfig} from '../../helpers/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

import {getWhale} from './utils';

export type User = {address: string} & {
  perpetual: Perpetual;
  vault: Vault;
  usdc: ERC20;
};

export interface TestEnv {
  deployer: User;
  user: User;
  bob: User;
  alice: User;
  users: User[];
  perpetual: Perpetual;
  vault: Vault;
  usdc: ERC20;
  vAMMconfig: iVAMMConfig;
}

const testEnv: TestEnv = {
  deployer: {} as User,
  user: {} as User,
  bob: {} as User,
  alice: {} as User,
  users: [] as User[],
  perpetual: {} as Perpetual,
  vault: {} as Vault,
  usdc: {} as ERC20,
  vAMMconfig: {} as iVAMMConfig,
} as TestEnv;

/// @notice: get all deployed contracts
const getContracts = async (deployerAccount: string) => {
  return {
    perpetual: <Perpetual>(
      await ethers.getContract('Perpetual', deployerAccount)
    ),
    vault: <Vault>await ethers.getContract('Vault', deployerAccount),
    usdc: <ERC20>(
      await ethers.getContractAt(
        'ERC20',
        getReserveAddress('USDC', getEthereumNetworkFromHRE(env))
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
export const setup = deployments.createFixture(async () => {
  // get contracts
  await deployments.fixture(['Perpetual', 'Vault']); // TODO: UPDATE THESE
  await logDeployments();
  const {deployer, bob, alice, user} = await getNamedAccounts();
  const contracts = await getContracts(deployer);

  // fill container
  testEnv.deployer = await setupUser(deployer, contracts);
  testEnv.user = await setupUser(user, contracts);
  testEnv.bob = await setupUser(bob, contracts);
  testEnv.alice = await setupUser(alice, contracts);
  testEnv.users = await setupUsers(await getUnnamedAccounts(), contracts);
  testEnv.perpetual = contracts.perpetual;
  testEnv.vault = contracts.vault;
  testEnv.usdc = contracts.usdc;
  testEnv.vAMMconfig = getVAMMConfig();

  return testEnv;
});
