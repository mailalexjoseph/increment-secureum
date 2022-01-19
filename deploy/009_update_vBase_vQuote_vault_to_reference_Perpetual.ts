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
  await vault.transferOwner(perpetual.address, true);

  console.log(
    'We have updated the references of vEUR, vUSD and Vault to Perpetual'
  );

  const MAX_MINT_AMOUNTS = [
    ethers.utils.parseEther('1000'),
    ethers.utils.parseEther('1000'),
  ];
  await perpetual.mintTokens(MAX_MINT_AMOUNTS);

  console.log('We have minted initial liquidity');
};
func.tags = ['UpdateReferencesToPerpetual'];
func.id = 'update_vBase_vQuote_vault_to_reference_Perpetual';
func.dependencies = ['AddChainlinkOracles', 'Perpetual'];

export default func;
