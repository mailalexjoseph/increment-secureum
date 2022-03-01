import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {getReserveAddress} from '../helpers/contracts-getters';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const insuranceConstructorArgs = [getReserveAddress('USDC', hre)];

  await hre.deployments.deploy('Insurance', {
    from: deployer,
    args: insuranceConstructorArgs,
    log: true,
  });

  console.log('We have deployed the vault');
};

func.tags = ['Insurance'];
func.id = 'deploy_insurance_contract';

export default func;
