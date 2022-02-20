import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

/// @dev Unlike in the code where it makes sense to keep the abstract `vBase` and `vQuote`,
/// the deployment script needs to contain the exact names.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  console.log(`Current network is ${hre.network.name.toString()}`);

  await hre.deployments.deploy('VBase', {
    from: deployer,
    args: ['vEUR base token', 'vEUR'],
    log: true,
  });
  console.log('We have deployed vEUR');

  await hre.deployments.deploy('VQuote', {
    from: deployer,
    args: ['vUSD quote token', 'vUSD'],
    log: true,
  });
  console.log('We have deployed vUSD');
};

func.tags = ['VirtualTokens'];
func.id = 'deploy_virtual_tokens';

export default func;
