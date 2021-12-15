import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {getCurveFactoryAddress} from '../helpers/contracts-deployments';
import curveFactoryAbi from '../contracts/dependencies/curve-factory-v2.json';
import {ZERO_ADDRESS} from '../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

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
  // for function overload in ethers.js, see https://docs.ethers.io/v5/single-page/#/v5/migration/web3/-%23-migration-from-web3-js--contracts--overloaded-functions
  await curveFactory[
    'deploy_plain_pool(string,string,address[4],uint256,uint256,uint256,uint256)'
  ](
    'vEUR/vUSD pair',
    'VEURVUSD',
    [vEUR.address, vUSD.address, ZERO_ADDRESS, ZERO_ADDRESS],
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
