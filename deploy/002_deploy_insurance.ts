import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {getVaultVersionToUse} from '../helpers/contracts-deployments';

import {getReserveAddress} from '../helpers/contracts-getters';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const vault = await ethers.getContract(getVaultVersionToUse(hre), deployer);

  // deploy reserve token when kovan
  let insuranceConstructorArgs;
  if (hre.network.name === 'kovan') {
    insuranceConstructorArgs = [
      (await ethers.getContract('USDCmock')).address,
      vault.address,
    ];
  } else {
    insuranceConstructorArgs = [getReserveAddress('USDC', hre), vault.address];
  }

  await hre.deployments.deploy('Insurance', {
    from: deployer,
    args: insuranceConstructorArgs,
    log: true,
  });

  // register insurance in vault
  const insurance = await ethers.getContract('Insurance', deployer);

  if ((await vault.insurance()) !== insurance.address) {
    await (await vault.setInsurance(insurance.address)).wait();
  }
  console.log('We have deployed the insurance');
};

func.tags = ['Insurance'];
func.id = 'deploy_insurance_contract';
func.dependencies = ['Token'];

export default func;
