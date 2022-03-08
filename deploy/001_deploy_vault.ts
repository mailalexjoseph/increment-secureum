import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {getReserveAddress} from '../helpers/contracts-getters';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  // deploy reserve token when kovan
  let vaultConstructorArgs;
  if (hre.network.name === 'kovan') {
    vaultConstructorArgs = [(await ethers.getContract('USDCmock')).address];
  } else {
    vaultConstructorArgs = [getReserveAddress('USDC', hre)];
  }

  await hre.deployments.deploy('Vault', {
    from: deployer,
    args: vaultConstructorArgs,
    log: true,
  });

  // set maxTVL
  const vault = await ethers.getContract('Vault', deployer);
  if ((await vault.getMaxTVL()).eq(0)) {
    await (await vault.setMaxTVL(ethers.constants.MaxUint256)).wait();
  }

  console.log('We have deployed the vault');
};

func.tags = ['Vault'];
func.id = 'deploy_vault_contract';

export default func;
