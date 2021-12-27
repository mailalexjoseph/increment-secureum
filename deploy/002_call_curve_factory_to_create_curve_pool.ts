import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {utils} from 'ethers';
import {logDeployments} from '../helpers/misc-utils';

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
    args: [
      deployer /* owner*/,
      deployer /* admin_fee_receiver*/,
      5000 * 2 ** 2 * 10000 /* A */,
      utils.parseEther('0.0001') /*  gamma*/,
      utils.parseEther('0.0005') /*  mid_fee*/,
      utils.parseEther('0.0045') /*  out_fee*/,
      utils.parseUnits('10', 10) /*  allowed_extra_profit*/,
      utils.parseEther('0.005') /*  fee_gamma*/,
      utils.parseEther('0.0000055') /*  adjustment_step*/,
      utils.parseUnits('5', 9) /*  admin_fee*/,
      600 /*  ma_half_time*/,
      utils.parseEther('1.2') /*  initial_price*/, // TODO: dont hardcode initial price
    ],
    log: true,
  });

  await logDeployments();

  console.log('We have deployed vEUR/vUSD curve pool');
};

func.tags = ['CurvePool'];
func.id = 'call_curve_factory_to_create_curve_pool';
func.dependencies = ['VirtualTokens'];

export default func;
