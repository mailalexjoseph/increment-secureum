import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {getCryptoSwapConstructorArgs} from '../helpers/contracts-deployments';
import {
  getCryptoSwapFactory,
  getChainlinkPrice,
} from '../helpers/contracts-getters';
import {ethers} from 'hardhat';

import {getCryptoSwapConstructorArgsSeparate} from '../helpers/contracts-deployments';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  // constructor arguments
  const vEUR = await ethers.getContract('VBase', deployer);
  const vUSD = await ethers.getContract('VQuote', deployer);

  const initialPrice = await getChainlinkPrice(hre, 'EUR_USD');
  console.log(
    'Use EUR/USD price of ',
    hre.ethers.utils.formatEther(initialPrice)
  );

  const args = getCryptoSwapConstructorArgs(
    'EUR_USD',
    vUSD.address,
    vEUR.address,
    initialPrice
  );

  // if (hre.network.name == 'kovan') {
  //   // deploy testPool
  //   // @dev: Have to deploy CurveTokenV5Test here since CurveTokenV5 requires knowledge of the curve pool address
  //   //      (see: https://github.com/Increment-Finance/increment-protocol/blob/9142b5f1f413550a63c97e13aab12ae42d46a1d0/contracts-vyper/contracts/Factory.vy#L208)

  //   // deploy curve token
  //   await hre.deployments.deploy('CurveTokenV5', {
  //     from: deployer,
  //     log: true,
  //   });
  //   const token = await ethers.getContract('CurveTokenV5', deployer);

  //   // deploy curve pool
  //   const constructorArgs = getCryptoSwapConstructorArgsSeparate(
  //     deployer,
  //     initialPrice,
  //     token.address,
  //     vUSD.address,
  //     vEUR.address
  //   );
  //   await hre.deployments.deploy('CurveCryptoSwapTest', {
  //     from: deployer,
  //     args: Object.values(constructorArgs),
  //     log: true,
  //   });
  // } else {
  // deploy
  const cryptoSwapFactory = await getCryptoSwapFactory(hre);
  console.log('Found CryptoSwapFactory at ', cryptoSwapFactory.address);

  await cryptoSwapFactory.deploy_pool(
    args._name,
    args._symbol,
    args._coins,
    args.A,
    args.gamma,
    args.mid_fee,
    args.out_fee,
    args.allowed_extra_profit,
    args.fee_gamma,
    args.adjustment_step,
    args.admin_fee,
    args.ma_half_time,
    args.initial_price
  );
  // }
};

func.tags = ['CurvePool'];
func.id = 'call_curve_factory_to_create_curve_pool';
func.dependencies = ['VirtualTokens'];

export default func;
