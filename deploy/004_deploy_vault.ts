import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {getVaultConstructorArgs} from '../helpers/contracts-deployments';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const oracle = await ethers.getContract('Oracle', deployer);

  const vaultConstructorArgs = getVaultConstructorArgs(hre, oracle.address);

  await hre.deployments.deploy('Vault', {
    from: deployer,
    args: vaultConstructorArgs,
    log: true,
  });

  console.log('We have deployed the vault');
};

func.tags = ['Vault'];
func.id = 'deploy_vault_contract';
func.dependencies = ['Oracle'];

export default func;
