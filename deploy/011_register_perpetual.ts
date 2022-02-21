import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {getPerpetualVersionToUse} from '../helpers/contracts-deployments';
import {clear} from 'console';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const perpetualVersionToUse = getPerpetualVersionToUse(hre);
  const perpetual = await ethers.getContract(perpetualVersionToUse, deployer);

  const vEUR = await ethers.getContract('VBase', deployer);
  const vUSD = await ethers.getContract('VQuote', deployer);
  const clearingHouse = await ethers.getContract('ClearingHouse', deployer);

  console.log('Check EUR owner');
  const vEURowner = await vEUR.owner();
  console.log('vEURowner: ', vEURowner);
  console.log('deployer.address', deployer);
  console.log('perpetual.address: ', perpetual.address);
  if (!(vEURowner === perpetual.address)) {
    await (await vEUR.transferOwner(perpetual.address, true)).wait();
  }
  console.log('Check USD owner');
  const vUSDowner = await vUSD.owner();
  console.log('vUSDowner: ', vUSDowner);
  if (!(vUSDowner === perpetual.address)) {
    await (await vUSD.transferOwner(perpetual.address, true)).wait();
  }
  console.log('Check Perpetual init');
  const registeredPerpetual = await clearingHouse.perpetuals(0);
  console.log('registeredPerpetual: ', registeredPerpetual);
  if ((await clearingHouse.numMarkets()) > 0) {
    if ((await clearingHouse.perpetuals(0)) !== perpetual.address) {
      await (await clearingHouse.allowListPerpetual(perpetual.address)).wait();
      console.log('Perpetual is allowed');
    } else {
      console.log('Perpetual is already allowed');
    }
  }
};
func.tags = ['UpdateReferencesToPerpetual'];
func.id = 'update_vBase_vQuote_vault_to_reference_Perpetual';
func.dependencies = ['AddChainlinkOracles', 'Perpetual'];

export default func;
