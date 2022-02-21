import {task} from 'hardhat/config';
import {HardhatRuntimeEnvironment} from 'hardhat/types';

task('set-minter', 'Set minter to curve lp token').setAction(
  async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const {deployer} = await hre.getNamedAccounts();

    const cryptoSwap = await hre.ethers.getContract(
      'CurveCryptoSwap2ETH',
      deployer
    );

    const token = await hre.ethers.getContract('CurveTokenV5.vy', deployer);

    // set cryptoswap as minter

    const name = await cryptoSwap.name();
    const symbol = await cryptoSwap.symbol();

    if ((await token.minter()) !== token.address) {
      await (await token.initialize(name, symbol, cryptoSwap.address)).wait();

      console.log('Vault set in Insurance');
    } else {
      console.log('Vault already set in Insurance');
    }
  }
);
