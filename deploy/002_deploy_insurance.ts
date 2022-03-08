import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {getReserveAddress} from '../helpers/contracts-getters';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  // deploy reserve token when kovan
  let insuranceConstructorArgs;
  if (hre.network.name === 'kovan') {
    insuranceConstructorArgs = [(await ethers.getContract('USDCmock')).address];
  } else {
    insuranceConstructorArgs = [getReserveAddress('USDC', hre)];
  }

  await hre.deployments.deploy('Insurance', {
    from: deployer,
    args: insuranceConstructorArgs,
    log: true,
  });

  // register insurance in vault
  const insurance = await ethers.getContract('Insurance', deployer);
  const vault = await ethers.getContract('Vault', deployer);

  if ((await vault.insurance()) !== insurance.address) {
    await (await vault.setInsurance(insurance.address)).wait();
  }
  console.log('We have deployed the insurance');
};

func.tags = ['Insurance'];
func.id = 'deploy_insurance_contract';
func.dependencies = ['Token'];

export default func;
