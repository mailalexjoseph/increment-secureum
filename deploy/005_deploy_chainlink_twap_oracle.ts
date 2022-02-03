import {ethers} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const chainlinkOracle = await ethers.getContract('ChainlinkOracle', deployer);

  await hre.deployments.deploy('ChainlinkTWAPOracle', {
    from: deployer,
    args: [chainlinkOracle.address],
    log: true,
  });

  console.log('We have deployed the Chainklink TWAP oracle');
};

func.tags = ['ChainlinkTWAPOracle'];
func.id = 'deploy_chainlink_twap_oracle';

export default func;
