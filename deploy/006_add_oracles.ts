import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';
import {expect} from 'chai';

import {
  getChainlinkOracle,
  getPerpetualVersionToUse,
} from '../helpers/contracts-deployments';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const perpetualVersionToUse = getPerpetualVersionToUse(hre);
  const perpetual = await ethers.getContract(perpetualVersionToUse, deployer);
  const oracle = await ethers.getContract('Oracle', deployer);

  await oracle.addAggregator(
    perpetual.address,
    getChainlinkOracle(hre, 'EUR_USD')
  );

  expect(await oracle.priceFeedMap(perpetual.address)).to.be.equal(
    getChainlinkOracle(hre, 'EUR_USD')
  );
  console.log('We have added chainlink oracles to the Oracle contract');
};

func.tags = ['AddOracles'];
func.id = 'add_oracles';
func.dependencies = ['Perpetual'];

export default func;
