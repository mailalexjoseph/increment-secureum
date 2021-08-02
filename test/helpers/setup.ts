import {Signer} from 'ethers';

import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import {setupUser, setupUsers} from './utils/setupUsers';

import {Perpetual, MintableERC20, AToken} from '../../typechain';

import {PerpConfig} from '../../markets/ethereum';

export interface TestEnv {
  deployer: Signer;
  users: Signer[];
  perpetual: Perpetual;
  dai: MintableERC20;
  aDai: AToken;
  usdc: MintableERC20;
}

const testEnv: TestEnv = {
  deployer: {} as Signer,
  users: [] as Signer[],
  perpetual: {} as Perpetual,
  dai: {} as MintableERC20,
  aDai: {} as AToken,
  usdc: {} as MintableERC20,
} as TestEnv;

export const setup = deployments.createFixture(async () => {
  // get contracts
  await deployments.fixture('Perpetual');
  testEnv.perpetual = await ethers.getContract('Perpetual');
  const contracts = {
    perpetual: testEnv.perpetual,
  };

  const {deployer} = await getNamedAccounts();

  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    ...contracts,
    users,
    data: PerpConfig.VAMMConfig,
    deployer: await setupUser(deployer, contracts),
  };
});
