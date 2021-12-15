import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {ethers} from 'hardhat';
import {getChainlinkOracle} from '../helpers/contracts-deployments';
import {expect} from 'chai';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const perpetual = await ethers.getContract('Perpetual', deployer);
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
