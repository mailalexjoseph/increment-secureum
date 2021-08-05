import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {logDeployments} from '../helpers/misc-utils';
import {
  getReserveAddress,
  getReserveOracleAddress,
} from '../helpers/contract-getters';
import {tEthereumAddress} from '../helpers/types';
import {ethers} from 'hardhat';

type SetReserveTokenArgs = [
  tEthereumAddress,
  tEthereumAddress,
  boolean,
  tEthereumAddress
];

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  //await logDeployments();

  const perpetual = await ethers.getContract('Perpetual');

  const usdcAddress = getReserveAddress('USDC');
  const usdcOracleAddress = getReserveOracleAddress('USDC');

  const setReserveTokenArgs: SetReserveTokenArgs = [
    usdcAddress,
    usdcOracleAddress,
    false,
    usdcAddress,
  ];
  await perpetual.setReserveToken(...setReserveTokenArgs);
  console.log('We have intitiated reserves');
};
export default func;
func.tags = ['InitiateReserves'];
func.id = 'initiate_reserves';
func.dependencies = ['Perpetual'];
