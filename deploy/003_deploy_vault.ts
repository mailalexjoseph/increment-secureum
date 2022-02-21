import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {getReserveAddress} from '../helpers/contracts-getters';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const vaultConstructorArgs = [
    (await ethers.getContract('ChainlinkOracle', deployer)).address,
    getReserveAddress('USDC', hre),
    (await ethers.getContract('Insurance', deployer)).address,
  ];

  await hre.deployments.deploy('Vault', {
    from: deployer,
    args: vaultConstructorArgs,
    log: true,
  });

  // register vault in contract
  const insurance = await ethers.getContract('Insurance', deployer);
  const vault = await ethers.getContract('Vault', deployer);

  if ((await insurance.vault()) !== vault.address) {
    await (await insurance.setVault(vault.address)).wait();
  }
  console.log('We have deployed the vault');
};

func.tags = ['Vault'];
func.id = 'deploy_vault_contract';
func.dependencies = ['ChainlinkOracle'];

export default func;
