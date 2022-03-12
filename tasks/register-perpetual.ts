import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('register-perpetual', 'Register perpetual in vault').setAction(
  async (_, hre: HardhatRuntimeEnvironment) => {
    const {deployer} = await hre.getNamedAccounts();

    // register vault in contract

    const vEUR = await hre.ethers.getContract('VBase', deployer);
    const vUSD = await hre.ethers.getContract('VQuote', deployer);
    const perpetual = await hre.ethers.getContract('Perpetual', deployer);
    const clearingHouse = await hre.ethers.getContract(
      'ClearingHouse',
      deployer
    );

    if ((await vEUR.owner()) !== perpetual.address) {
      await (await vEUR.transferOwner(perpetual.address, true)).wait();
      console.log('vEUR owner is transferred');
    } else {
      console.log('vEUR owner is already transferred');
    }

    if ((await vUSD.owner()) !== perpetual.address) {
      await (await vUSD.transferOwner(perpetual.address, true)).wait();
      console.log('vUSD owner is transferred');
    } else {
      console.log('vUSD owner is already transferred');
    }

    if ((await clearingHouse.getNumMarkets()).eq(0)) {
      await (await clearingHouse.allowListPerpetual(perpetual.address)).wait();
      console.log('Perpetual is allowed');
    }
  }
);
