import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {getPerpetualVersionToUse} from '../helpers/contracts-deployments';
import {getChainlinkOracle} from '../helpers/contracts-getters';
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const perpetualVersionToUse = getPerpetualVersionToUse(hre);
  const perpetual = await hre.ethers.getContract(
    perpetualVersionToUse,
    deployer
  );
  const chainlinkTWAPOracle = await hre.ethers.getContract(
    'ChainlinkTWAPOracle',
    deployer
  );
  const chainlinkOracle = await hre.ethers.getContract(
    'ChainlinkOracle',
    deployer
  );

  // const EUR_USD_ORACLE1 = await chainlinkOracle.priceFeedMap(perpetual.address);
  // if (!(EUR_USD_ORACLE1 === getChainlinkOracle(hre, 'EUR_USD'))) {
  //   await (
  await chainlinkOracle.addAggregator(
    perpetual.address,
    getChainlinkOracle(hre, 'EUR_USD')
  );
  //   ).wait();
  // }

  // const EUR_USD_ORACLE2 = await chainlinkOracle.priceFeedMap(perpetual.address);
  // if (!(EUR_USD_ORACLE2 === getChainlinkOracle(hre, 'EUR_USD'))) {
  //   await (
  await chainlinkOracle.addAggregator(
    chainlinkTWAPOracle.address,
    getChainlinkOracle(hre, 'EUR_USD')
  );
  //   ).wait();
  // }
  console.log(
    'We have added chainlink oracles to the ChainlinkOracle contract'
  );
};

func.tags = ['AddChainlinkOracles'];
func.id = 'add_chainlinkOracles';
func.dependencies = ['Perpetual'];

export default func;
