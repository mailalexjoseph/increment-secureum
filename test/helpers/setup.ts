import {Signer} from 'ethers';
import {
  ethers,
  deployments,
  getUnnamedAccounts,
  getNamedAccounts,
} from 'hardhat';
import {getReserveAddress} from '../../helpers/contract-getters';
import {setupUser, setupUsers, logDeployments} from '../../helpers/misc-utils';

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
  //console.log('We are before running fixtures');
  await deployments.fixture(['Perpetual', 'InitiateReserves']);
  await logDeployments();

  const {deployer} = await getNamedAccounts();

  const contracts = {
    perpetual: <Perpetual>await ethers.getContract('Perpetual', deployer),
    usdc: <MintableERC20>(
      await ethers.getContractAt('MintableERC20', getReserveAddress('USDC'))
    ),
  };

  const users = await setupUsers(await getUnnamedAccounts(), contracts);

  return {
    ...contracts,
    users,
    data: PerpConfig.VAMMConfig,
    deployer: await setupUser(deployer, contracts),
  };
});
