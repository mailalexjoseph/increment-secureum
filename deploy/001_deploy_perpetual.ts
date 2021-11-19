import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {getPerpetualConstructorArgs} from '../helpers/contracts-deployments';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  console.log(`Current network is ${hre.network.name.toString()}`);
  const perpetualConstructorArgs = getPerpetualConstructorArgs();

  await hre.deployments.deploy('Perpetual', {
    from: deployer,
    args: perpetualConstructorArgs,
    log: true,
  });
  console.log('We have deployed the perpetual');
};
export default func;
func.tags = ['Perpetual'];
func.id = 'deploy_perpetual_contract';
