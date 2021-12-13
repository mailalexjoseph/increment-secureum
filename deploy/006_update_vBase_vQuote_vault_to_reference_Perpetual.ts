import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  console.log(`Current network is ${hre.network.name.toString()}`);

  const vEUR = await ethers.getContract('VBase', deployer);
  const vUSD = await ethers.getContract('VQuote', deployer);
  const vault = await ethers.getContract('Vault', deployer);
  const perpetual = await ethers.getContract('Perpetual', deployer);

  await vEUR.transferOwner(perpetual.address, true);
  await vUSD.transferOwner(perpetual.address, true);
  await vault.transferOwner(perpetual.address, true);

  console.log(
    'We have updated the references of vEUR, vUSD and Vault to Perpetual'
  );
};

func.tags = ['UpdateReferencesToPerpetual'];
func.id = 'update_vBase_vQuote_vault_to_reference_Perpetual';
func.dependencies = ['Perpetual'];

export default func;
