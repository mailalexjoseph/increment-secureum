import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getVaultConstructorArgs} from '../helpers/contracts-deployments';
import {ethers} from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  //await logDeployments();

  const perpetual = await ethers.getContract('Perpetual', deployer);
  const oracle = await ethers.getContract('Oracle', deployer);

  const vaultConstructorArgs = getVaultConstructorArgs(
    hre,
    perpetual.address,
    oracle.address
  );
  await hre.deployments.deploy('Vault', {
    from: deployer,
    args: vaultConstructorArgs,
    log: true,
  });
  console.log('We have deployed the vault');
};
export default func;
func.tags = ['Vault'];
func.id = 'deploy_vault_contract';
func.dependencies = ['Perpetual'];
