import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {getEthereumNetworkFromHRE} from '../helpers/misc-utils';
import {getNetworkParameters} from '../helpers/contracts-deployments';
import {eEthereumNetwork} from '../helpers/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;
  const {deployer} = await getNamedAccounts();

  const network: eEthereumNetwork = getEthereumNetworkFromHRE(hre);

  const constructorArgs = getNetworkParameters(network);

  await deploy('Perpetual', {
    from: deployer,
    args: constructorArgs,
    log: true,
  });
};
export default func;
func.tags = ['Perpetual'];
