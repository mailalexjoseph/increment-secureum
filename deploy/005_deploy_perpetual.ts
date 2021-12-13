import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

import {getCurveFactoryAddress} from '../helpers/contracts-deployments';
import curveFactoryAbi from '../contracts/dependencies/curve-factory-v2.json';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  console.log(`Current network is ${hre.network.name.toString()}`);

  const oracle = await ethers.getContract('Oracle', deployer);
  const vEUR = await ethers.getContract('VBase', deployer);
  const vUSD = await ethers.getContract('VQuote', deployer);
  const vault = await ethers.getContract('Vault', deployer);

  const curveFactoryAddress = getCurveFactoryAddress(hre);
  const curveFactory = await ethers.getContractAt(
    curveFactoryAbi,
    curveFactoryAddress,
    deployer
  );
  // see: https://github.com/curvefi/curve-factory/blob/fb61207c8d1095096dc07f2c705cf02d40757635/contracts/Factory.vy#L169
  const VEURVUSDPoolAddress = await curveFactory[
    'find_pool_for_coins(address,address)'
  ](vEUR.address, vUSD.address);

  const perpetualArgs = [
    oracle.address,
    vEUR.address,
    vUSD.address,
    VEURVUSDPoolAddress,
    vault.address,
  ];

  await hre.deployments.deploy('Perpetual', {
    from: deployer,
    args: perpetualArgs,
    log: true,
  });

  console.log('We have deployed the perpetual');
};

func.tags = ['Perpetual'];
func.id = 'deploy_perpetual_contract';
func.dependencies = ['VirtualTokens', 'CurvePool', 'Oracle', 'Vault'];

export default func;
