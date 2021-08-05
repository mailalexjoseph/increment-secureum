import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import {getReserveAddress, getVAMMConfig} from '../../helpers/contract-getters';
import {setupUser, setupUsers, logDeployments} from '../../helpers/misc-utils';

import {Perpetual, MintableERC20} from '../../typechain';

import {iVAMMConfig} from '../../helpers/types';

export interface TestEnv {
  // TODO: Define type for deployer/user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deployer: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: any[];
  perpetual: Perpetual;
  usdc: MintableERC20;
  data: iVAMMConfig;
}

const testEnv: TestEnv = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deployer: {} as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  users: [] as any[],
  perpetual: {} as Perpetual,
  usdc: {} as MintableERC20,
  data: {} as iVAMMConfig,
} as TestEnv;

export const setup = deployments.createFixture(async () => {
  // get contracts
  //console.log('We are before running fixtures');
  await deployments.fixture(['Perpetual', 'InitiateReserves']);
  await logDeployments();

  const {deployer} = await getNamedAccounts();

  // write contracts to dict to setup()
  const contracts = {
    perpetual: <Perpetual>await ethers.getContract('Perpetual', deployer),
    usdc: <MintableERC20>(
      await ethers.getContractAt('MintableERC20', getReserveAddress('USDC'))
    ),
  };

  // fill container
  testEnv.deployer = await setupUser(deployer, contracts);
  testEnv.users = await setupUsers(await getUnnamedAccounts(), contracts);
  testEnv.perpetual = contracts.perpetual;
  testEnv.usdc = contracts.usdc;
  testEnv.data = getVAMMConfig();

  return testEnv;
});
