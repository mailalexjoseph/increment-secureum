import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getCryptoSwapConstructorArgs} from '../../../helpers/contracts-deployments';
import {ethers} from 'hardhat';

export const initialPrice = ethers.utils.parseEther('1.131523');

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  // deploy Curve LP Token
  await hre.deployments.deploy('CurveTokenV5', {
    from: deployer,
    args: ['vEUR/vUSD', 'EURUSD'],
    log: true,
  });

  console.log(
    'Use FIXED EUR/USD price of ',
    hre.ethers.utils.formatEther(initialPrice)
  );
  // deploy CryptoSwap
  const vEUR = await ethers.getContract('VBase', deployer);
  const vUSD = await ethers.getContract('VQuote', deployer);
  const curveLPtoken = await ethers.getContract('CurveTokenV5', deployer);
  const cryptoSwapConstructorArgs = getCryptoSwapConstructorArgs(
    deployer,
    initialPrice,
    curveLPtoken.address,
    vUSD.address,
    vEUR.address
  );
  await hre.deployments.deploy('CryptoSwap', {
    from: deployer,
    args: Object.values(cryptoSwapConstructorArgs),
    log: true,
  });
  const cryptoSwap = await ethers.getContract('CryptoSwap', deployer);

  // transfer minter role to curve pool
  await curveLPtoken.set_minter(cryptoSwap.address);

  console.log('We have deployed vEUR/vUSD curve pool');
};

func.tags = ['CurvePool_test'];
func.id = 'call_curve_factory_to_create_curve_pool_test';
func.dependencies = ['VirtualTokens_test'];

export default func;
