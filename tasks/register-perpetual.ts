import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

// TODO: use argument of perpetual contract here
task('register-perpetual', 'Register perpetual in vault').setAction(
  async (taskArgs, hre: HardhatRuntimeEnvironment) => {
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

    console.log(clearingHouse.address);
    console.log(
      'perpetuals(0)',
      (await clearingHouse.perpetuals(0)).toString()
    );

    if ((await clearingHouse.numMarkets()) > 0) {
      if ((await clearingHouse.perpetuals(0)) !== perpetual.address) {
        await (
          await clearingHouse.allowListPerpetual(perpetual.address)
        ).wait();
        console.log('Perpetual is allowed');
      } else {
        console.log('Perpetual is already allowed');
      }
    }
  }
);
