import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const oracle = await ethers.getContract('Oracle', deployer);
  const vEUR = await ethers.getContract('VBase', deployer);
  const vUSD = await ethers.getContract('VQuote', deployer);
  const vault = await ethers.getContract('Vault', deployer);
  const market = await ethers.getContract('CryptoSwap', deployer);

  const perpetualArgs = [
    oracle.address,
    vEUR.address,
    vUSD.address,
    market.address,
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
