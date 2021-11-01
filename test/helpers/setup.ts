import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import {getEthereumNetworkFromHRE} from '../../helpers/misc-utils';
import {getReserveAddress, getVAMMConfig} from '../../helpers/contract-getters';
import {
  setupUser,
  setupUsers,
  logDeployments,
  impersonateAccountsHardhat,
} from '../../helpers/misc-utils';
import {convertToCurrencyDecimals} from '../../helpers/contracts-helpers';
import {BigNumber, tEthereumAddress} from '../../helpers/types';

import env = require('hardhat');
import {Perpetual, ERC20} from '../../typechain';
import {getWhale} from './utils';
import {iVAMMConfig} from '../../helpers/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
export interface TestEnv {
  // TODO: Define type for deployer/user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deployer: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bob: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  alice: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: any[];
  perpetual: Perpetual;
  usdc: ERC20;
  vAMMconfig: iVAMMConfig;
}

const testEnv: TestEnv = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deployer: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bob: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  alice: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: [] as any[],
  perpetual: {} as Perpetual,
  usdc: {} as ERC20,
  vAMMconfig: {} as iVAMMConfig,
} as TestEnv;

const getContracts = async (deployerAccount: string) => {
  return {
    perpetual: <Perpetual>(
      await ethers.getContract('Perpetual', deployerAccount)
    ),
    usdc: <ERC20>(
      await ethers.getContractAt(
        'ERC20',
        getReserveAddress('USDC', getEthereumNetworkFromHRE(env))
      )
    ),
  };
};

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

async function fundAcount(account: string): Promise<BigNumber> {
  const {usdc} = await getContracts(account);
  const fullAmount = await convertToCurrencyDecimals(usdc, '100');
  await stealFunds(usdc, account, fullAmount, env);
  return fullAmount;
}

export const funding = deployments.createFixture(async () => {
  const {bob, alice, user} = await getNamedAccounts();
  await fundAcount(bob);
  await fundAcount(alice);
  return await fundAcount(user);
});

export const setup = deployments.createFixture(async () => {
  // get contracts
  //console.log('We are before running fixtures');
  await deployments.fixture(['Perpetual', 'InitiateReserves']);
  await logDeployments();

  const {deployer, bob, alice, user} = await getNamedAccounts();

  const contracts = await getContracts(deployer);

  // usds = await deployments.get("USDC")
  // fill container
  testEnv.deployer = await setupUser(deployer, contracts);
  testEnv.user = await setupUser(user, contracts);
  testEnv.bob = await setupUser(bob, contracts);
  testEnv.alice = await setupUser(alice, contracts);
  testEnv.users = await setupUsers(await getUnnamedAccounts(), contracts);
  testEnv.perpetual = contracts.perpetual;
  testEnv.usdc = contracts.usdc;
  testEnv.vAMMconfig = getVAMMConfig();

  return testEnv;
});
