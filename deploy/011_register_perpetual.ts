import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {getPerpetualVersionToUse} from '../helpers/contracts-deployments';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const perpetualVersionToUse = getPerpetualVersionToUse(hre);
  const perpetual = await ethers.getContract(perpetualVersionToUse, deployer);

  const vEUR = await ethers.getContract('VBase', deployer);
  const vUSD = await ethers.getContract('VQuote', deployer);
  const clearingHouse = await ethers.getContract('ClearingHouse', deployer);

  if ((await vEUR.owner()) !== perpetual.address) {
    await (await vEUR.transferOwner(perpetual.address, true)).wait();
  } else {
    console.log('vEUR owner is already transferred');
  }

  if ((await vUSD.owner()) !== perpetual.address) {
    await (await vUSD.transferOwner(perpetual.address, true)).wait();
  } else {
  }

  await clearingHouse.allowListPerpetual(perpetual.address);
  // const listedMarket = await clearingHouse.numMarkets();
  // if (listedMarket.lt(1)) {
  //   await (await clearingHouse.allowListPerpetual(perpetual.address)).wait();
  //   console.log('Perpetual is allowed');
  // } else {
  //   console.log('Perpetual is already allowed');
  // }
};
func.tags = ['UpdateReferencesToPerpetual'];
func.id = 'update_vBase_vQuote_vault_to_reference_Perpetual';
func.dependencies = ['AddChainlinkOracles', 'Perpetual'];

export default func;
