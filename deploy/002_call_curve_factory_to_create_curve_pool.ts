import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {getCurveFactoryAddress} from '../helpers/contracts-deployments';
import curveFactoryAbi from '../contracts/dependencies/curve-factory-v2.json';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  console.log(`Current network is ${hre.network.name.toString()}`);

  const curveFactoryAddress = getCurveFactoryAddress(hre);

  const vEUR = await ethers.getContract('VBase', deployer);
  const vUSD = await ethers.getContract('VQuote', deployer);
  const curveFactory = await ethers.getContractAt(
    curveFactoryAbi,
    curveFactoryAddress,
    deployer
  );

  // see ICurveFactory arguments detail
  // note: in deploy_perpetual, we get the address of the deployed pool with `curveFactory.find_pool_for_coins`
  // see: https://github.com/curvefi/curve-factory/blob/fb61207c8d1095096dc07f2c705cf02d40757635/contracts/Factory.vy#L169
  curveFactory.deploy_plain_pool(
    'vEUR/vUSD pair',
    'VEURVUSD',
    [vEUR.address, vUSD.address],
    30,
    4000000,
    3,
    0
  );

  console.log('We have deployed vEUR/vUSD curve pool');
};

func.tags = ['CurvePool'];
func.id = 'call_curve_factory_to_create_curve_pool';
func.dependencies = ['VirtualTokens'];

export default func;
