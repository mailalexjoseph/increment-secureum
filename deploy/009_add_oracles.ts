import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import {getChainlinkOracle} from '../helpers/contracts-getters';
import {ethers} from 'hardhat';
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const chainlinkOracle = await ethers.getContract('ChainlinkOracle', deployer);

  // const EUR_USD_ORACLE1 = await chainlinkOracle.priceFeedMap(perpetual.address);
  // if (!(EUR_USD_ORACLE1 === getChainlinkOracle(hre, 'EUR_USD'))) {
  //   await (
  await chainlinkOracle.addAggregator(getChainlinkOracle(hre, 'EUR_USD'));
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
