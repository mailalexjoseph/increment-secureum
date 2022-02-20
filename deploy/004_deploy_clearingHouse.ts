import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const clearingHouseConstructorArgs = [
    (await ethers.getContract('Vault', deployer)).address,
    (await ethers.getContract('Insurance', deployer)).address,
  ];

  await hre.deployments.deploy('ClearingHouse', {
    from: deployer,
    args: clearingHouseConstructorArgs,
    log: true,
  });

  const vault = await ethers.getContract('Vault', deployer);
  const clearingHouse = await ethers.getContract('ClearingHouse', deployer);
  await vault.setClearingHouse(clearingHouse.address);

  console.log('We have deployed the ClearingHouse');
};

func.tags = ['ClearingHouse'];
func.id = 'deploy_clearing_house';
func.dependencies = ['Vault', 'Insurance'];

export default func;
