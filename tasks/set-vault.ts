import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('set-insurance', 'Compiles vyper contracts and copy to folder').setAction(
  async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const {deployer} = await hre.getNamedAccounts();

    // register vault in contract
    const insurance = await hre.ethers.getContract('Insurance', deployer);
    const vault = await hre.ethers.getContract('Vault', deployer);

    if ((await insurance.vault()) !== vault.address) {
      await (await insurance.setVault(vault.address)).wait();

      console.log('Vault set in Insurance');
    } else {
      console.log('Vault already set in Insurance');
    }
  }
);
