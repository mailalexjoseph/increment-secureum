import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

/// @dev Unlike in the code where it makes sense to keep the abstract `vBase` and `vQuote`,
/// the deployment script needs to contain the exact names.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  await hre.deployments.deploy('TestLibFunding', {
    from: deployer,
    log: true,
  });
};

func.tags = ['TestLibFunding'];
func.id = 'deploy_test_lib_funding';

export default func;
