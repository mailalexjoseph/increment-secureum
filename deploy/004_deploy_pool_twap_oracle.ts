import {ethers} from 'hardhat';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const pool = await ethers.getContract('CryptoSwap', deployer);

  await hre.deployments.deploy('PoolTWAPOracle', {
    from: deployer,
    args: [pool.address],
    log: true,
  });

  console.log('We have deployed the pool TWAP oracle');
};

func.tags = ['PoolTWAPOracle'];
func.id = 'deploy_pool_twap_oracle';

export default func;
