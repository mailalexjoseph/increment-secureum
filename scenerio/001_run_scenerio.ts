import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {deployments, ethers, getNamedAccounts} from 'hardhat';

import {ERC20} from '../typechain/ERC20';
import {fundAccountWithUSDC} from '../test/integration/helpers/utils/manipulateStorage';
import {funding} from '../test/integration/helpers/setup';
import {getEthereumNetworkFromHRE} from '../helpers/misc-utils';
import {getReserveAddress} from '../helpers/contract-getters';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await getNamedAccounts();

  // Correctly logs deployed contracts
  const contracts = await deployments.all();
  console.log(contracts);

  // This works
  const usdcAddress = getReserveAddress('USDC', getEthereumNetworkFromHRE(hre));
  const usdc = <ERC20>await ethers.getContractAt('ERC20', usdcAddress);
  console.log(usdcAddress);
  fundAccountWithUSDC(hre, usdc, deployer, ethers.BigNumber.from(1000000));

  // This also works
  funding();

  // Works perfectly
  console.log(await ethers.getContract('VQuote', deployer));
};

func.tags = ['fundAccounts'];
func.id = 'fund_accounts';

export default func;
