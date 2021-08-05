import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {getEthereumNetworkFromHRE} from '../helpers/misc-utils';
import {getConstructorArgsByNetwork} from '../helpers/contracts-deployments';
import {eEthereumNetwork} from '../helpers/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deploy} = hre.deployments;

  const {deployer} = await hre.getNamedAccounts();

  console.log(`Current network is ${hre.network.name.toString()}`);
  const network: eEthereumNetwork = getEthereumNetworkFromHRE(hre);

  const constructorArgs = getConstructorArgsByNetwork(network);

  await deploy('Perpetual', {
    from: deployer,
    args: constructorArgs,
    log: true,
  });
  console.log('We have deployed the perpetual');
};
export default func;
func.tags = ['Perpetual'];
func.id = 'deploy_perpetual_contract';
