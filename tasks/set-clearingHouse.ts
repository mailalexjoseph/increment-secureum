import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('set-insurance', 'Set clearinghouse in vault').setAction(
  async (_, hre: HardhatRuntimeEnvironment) => {
    const {deployer} = await hre.getNamedAccounts();

    // register vault in contract
    const vault = await hre.ethers.getContract('Vault', deployer);
    const clearingHouse = await hre.ethers.getContract(
      'ClearingHouse',
      deployer
    );

    if ((await vault.clearingHouse()) !== clearingHouse.address) {
      await (await vault.setClearingHouse(clearingHouse.address)).wait();

      console.log('ClearingHouse set in Vault');
    } else {
      console.log('ClearingHouse already set in Vault');
    }
  }
);
