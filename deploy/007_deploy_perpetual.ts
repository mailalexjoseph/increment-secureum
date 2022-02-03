import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';
import {getPerpetualVersionToUse} from '../helpers/contracts-deployments';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const chainlinkOracle = await ethers.getContract('ChainlinkOracle', deployer);
  const poolTWAPOracle = await ethers.getContract('PoolTWAPOracle', deployer);
  const chainlinkTWAPOracle = await ethers.getContract(
    'ChainlinkTWAPOracle',
    deployer
  );
  const vEUR = await ethers.getContract('VBase', deployer);
  const vUSD = await ethers.getContract('VQuote', deployer);
  const vault = await ethers.getContract('Vault', deployer);
  const market = await ethers.getContract('CryptoSwap', deployer);

  const perpetualArgs = [
    chainlinkOracle.address,
    poolTWAPOracle.address,
    chainlinkTWAPOracle.address,
    vEUR.address,
    vUSD.address,
    market.address,
    vault.address,
  ];

  const perpetualVersionToUse = getPerpetualVersionToUse(hre);
  await hre.deployments.deploy(perpetualVersionToUse, {
    from: deployer,
    args: perpetualArgs,
    log: true,
  });

  console.log('We have deployed Perpetual');
};

func.tags = ['Perpetual'];
func.id = 'deploy_perpetual_contract';
func.dependencies = [
  'VirtualTokens',
  'CurvePool',
  'ChainlinkOracle',
  'PoolTWAPOracle',
  'ChainlinkTWAPOracle',
  'Vault',
];

export default func;