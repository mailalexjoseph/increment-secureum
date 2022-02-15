import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {getPerpetualVersionToUse} from '../helpers/contracts-deployments';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const perpetualVersionToUse = getPerpetualVersionToUse(hre);
  const vEUR = await ethers.getContract('VBase', deployer);
  const vUSD = await ethers.getContract('VQuote', deployer);
  const vault = await ethers.getContract('Vault', deployer);
  const perpetual = await ethers.getContract(perpetualVersionToUse, deployer);

  await vEUR.transferOwner(perpetual.address, true);
  await vUSD.transferOwner(perpetual.address, true);
  await vault.addMarket(perpetual.address);
};
func.tags = ['UpdateReferencesToPerpetual'];
func.id = 'update_vBase_vQuote_vault_to_reference_Perpetual';
func.dependencies = ['AddChainlinkOracles', 'Perpetual'];

export default func;
