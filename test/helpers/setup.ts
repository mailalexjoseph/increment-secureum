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
import {
  eEthereumNetwork,
  BigNumber,
  tEthereumAddress,
} from '../../helpers/types';
import env = require('hardhat');
import {Perpetual, MintableERC20, ERC20} from '../../typechain';
import {getWhale} from './utils';
import {iVAMMConfig} from '../../helpers/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
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

const getContracts = async (deployerAccount: string) => {
  return {
    perpetual: <Perpetual>(
      await ethers.getContract('Perpetual', deployerAccount)
    ),
    usdc: <MintableERC20>(
      await ethers.getContractAt(
        'MintableERC20',
        getReserveAddress('USDC', getEthereumNetworkFromHRE(env))
      )
    ),
  };
};

export async function getFunds(
  tokenName: string,
  newHolder: tEthereumAddress,
  balance: BigNumber,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const token: ERC20 = await ethers.getContractAt(
    'MintableERC20',
    getReserveAddress('USDC', getEthereumNetworkFromHRE(env))
  );
  const whaleAddress = await getWhale(token, balance);
  await impersonateAccountsHardhat([whaleAddress], hre);
  const whale = await setupUser(whaleAddress, {token: token});
  whale.token.transfer(newHolder, balance);
}
export const setup = deployments.createFixture(async () => {
  // get contracts
  //console.log('We are before running fixtures');
  await deployments.fixture(['Perpetual', 'InitiateReserves']);
  await logDeployments();

  const {deployer} = await getNamedAccounts();

  const contracts = await getContracts(deployer);
  // fill container
  testEnv.deployer = await setupUser(deployer, contracts);
  testEnv.users = await setupUsers(await getUnnamedAccounts(), contracts);
  testEnv.perpetual = contracts.perpetual;
  testEnv.usdc = contracts.usdc;
  testEnv.data = getVAMMConfig();

  return testEnv;
});
