import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {logDeployments} from '../helpers/misc-utils';
import {getCurveFactoryAddress} from '../helpers/contracts-deployments';
import curveFactoryAbi from '../contracts/dependencies/curve-factory-v2.json';
import {ZERO_ADDRESS} from '../helpers/constants';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  // owner: address,
  // admin_fee_receiver: address,
  // A: uint256,
  // gamma: uint256,
  // mid_fee: uint256,
  // out_fee: uint256,
  // allowed_extra_profit: uint256,
  // fee_gamma: uint256,
  // adjustment_step: uint256,
  // admin_fee: uint256,
  // ma_half_time: uint256,
  // initial_price: uint256

  await hre.deployments.deploy('CryptoSwap', {
    from: deployer,
    args: [deployer, deployer, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    log: true,
  });

  await logDeployments();

  console.log('We have deployed vEUR/vUSD curve pool');
};

func.tags = ['CurvePool'];
func.id = 'call_curve_factory_to_create_curve_pool';
func.dependencies = ['VirtualTokens'];

export default func;
