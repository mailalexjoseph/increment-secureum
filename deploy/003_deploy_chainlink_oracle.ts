import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {getChainlinkOracleConstructorArgs} from '../helpers/contracts-deployments';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  // TODO: Do we really  need the feed registry here => No deleted!
  // const chainlinkOracleConstructorArgs = getChainlinkOracleConstructorArgs(hre);

  await hre.deployments.deploy('ChainlinkOracle', {
    from: deployer,
    log: true,
  });

  console.log('We have deployed the chainlink oracle');
};

func.tags = ['ChainlinkOracle'];
func.id = 'deploy_chainlink_oracle_contract';

export default func;
