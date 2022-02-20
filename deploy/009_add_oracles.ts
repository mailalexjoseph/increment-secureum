import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';
import {expect} from 'chai';

import {getPerpetualVersionToUse} from '../helpers/contracts-deployments';
import {getChainlinkOracle} from '../helpers/contracts-getters';
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const perpetualVersionToUse = getPerpetualVersionToUse(hre);
  const perpetual = await ethers.getContract(perpetualVersionToUse, deployer);
  const chainlinkTWAPOracle = await ethers.getContract(
    'ChainlinkTWAPOracle',
    deployer
  );
  const chainlinkOracle = await ethers.getContract('ChainlinkOracle', deployer);

  await chainlinkOracle.addAggregator(
    perpetual.address,
    getChainlinkOracle(hre, 'EUR_USD')
  );

  await chainlinkOracle.addAggregator(
    chainlinkTWAPOracle.address,
    getChainlinkOracle(hre, 'EUR_USD')
  );

  expect(await chainlinkOracle.priceFeedMap(perpetual.address)).to.be.equal(
    getChainlinkOracle(hre, 'EUR_USD')
  );
  console.log(
    'We have added chainlink oracles to the ChainlinkOracle contract'
  );
};

func.tags = ['AddChainlinkOracles'];
func.id = 'add_chainlinkOracles';
func.dependencies = ['Perpetual'];

export default func;
