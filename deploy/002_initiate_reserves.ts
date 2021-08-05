import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getInitArgs} from '../helpers/contracts-deployments';
import {ethers} from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  //await logDeployments();

  const perpetual = await ethers.getContract('Perpetual', deployer);

  const setReserveTokenArgs = getInitArgs(hre);

  await perpetual.setReserveToken(...setReserveTokenArgs);
  console.log('We have intitiated reserves');
};
export default func;
func.tags = ['InitiateReserves'];
func.id = 'initiate_reserves';
func.dependencies = ['Perpetual'];
