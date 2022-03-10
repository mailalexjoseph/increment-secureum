import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  console.log(`Current network is ${hre.network.name.toString()}`);

  const {deployer} = await hre.getNamedAccounts();

  // deploy reserve token when kovan
  if (hre.network.name === 'kovan') {
    await hre.deployments.deploy('USDCmock', {
      from: deployer,
      args: ['USDC', 'USDC Mock', 6],
      log: true,
    });

    console.log('We have deployed mock token');
  }
};

func.tags = ['Token'];
func.id = 'deploy_test_token';

export default func;
