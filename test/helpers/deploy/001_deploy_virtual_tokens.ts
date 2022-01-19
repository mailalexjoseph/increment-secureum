import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

/// @dev Unlike in the code where it makes sense to keep the abstract `vBase` and `vQuote`,
/// the deployment script needs to contain the exact names.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  console.log(`Current network is ${hre.network.name.toString()}`);

  await hre.deployments.deploy('VBase', {
    from: deployer,
    args: ['Long EUR/USD', 'vEUR'],
    log: true,
  });
  console.log('We have deployed vEUR');

  await hre.deployments.deploy('VQuote', {
    from: deployer,
    args: ['Short EUR/USD', 'vUSD'],
    log: true,
  });
  console.log('We have deployed vUSD');
};

func.tags = ['VirtualTokens_test'];
func.id = 'deploy_virtual_tokens_test';

export default func;
