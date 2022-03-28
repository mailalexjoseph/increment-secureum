import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';
import {getVaultVersionToUse} from '../helpers/contracts-deployments';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const vault = await ethers.getContract(getVaultVersionToUse(hre), deployer);

  await hre.deployments.deploy('ClearingHouse', {
    from: deployer,
    args: [vault.address],
    log: true,
  });

  // register clearingHouse in vault
  const clearingHouse = await ethers.getContract('ClearingHouse', deployer);

  if ((await vault.clearingHouse()) !== clearingHouse.address) {
    await (await vault.setClearingHouse(clearingHouse.address)).wait();
  }

  // deploy clearingHouseViewer
  await hre.deployments.deploy('ClearingHouseViewer', {
    from: deployer,
    args: [clearingHouse.address],
    log: true,
  });

  console.log('We have deployed the ClearingHouse');
};

func.tags = ['ClearingHouse'];
func.id = 'deploy_clearing_house';
func.dependencies = ['Vault', 'Insurance'];

export default func;
