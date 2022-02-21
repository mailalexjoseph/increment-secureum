import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';
import {getPerpetualVersionToUse} from '../helpers/contracts-deployments';
import {
  getCryptoSwap,
  getCryptoSwapFactory,
} from '../helpers/contracts-getters';

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

  let cryptoswap;
  if (hre.network.name == 'kovan') {
    cryptoswap = await ethers.getContract('CurveCryptoSwapTest', deployer);
  } else {
    const factory = await getCryptoSwapFactory(hre);
    cryptoswap = await getCryptoSwap(factory);
  }

  const clearingHouse = await ethers.getContract('ClearingHouse', deployer);

  const perpetualArgs = [
    chainlinkOracle.address,
    poolTWAPOracle.address,
    chainlinkTWAPOracle.address,
    vEUR.address,
    vUSD.address,
    cryptoswap.address,
    clearingHouse.address,
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
  'ClearingHouse',
];

export default func;
