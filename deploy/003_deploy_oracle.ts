import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {getOracleConstructorArgs} from '../helpers/contracts-deployments';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  // TODO: Do we really  need the feed registry here????
  const oracleConstructorArgs = getOracleConstructorArgs(hre);

  await hre.deployments.deploy('Oracle', {
    from: deployer,
    args: oracleConstructorArgs,
    log: true,
  });

  console.log('We have deployed the oracle');
};

func.tags = ['Oracle'];
func.id = 'deploy_oracle_contract';

export default func;
