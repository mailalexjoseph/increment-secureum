import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {
  getCryptoSwap,
  getCryptoSwapFactory,
} from '../helpers/contracts-getters';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  let cryptoswap;
  if (hre.network.name == 'kovan') {
    cryptoswap = await hre.ethers.getContract('CurveCryptoSwapTest', deployer);
  } else {
    const factory = await getCryptoSwapFactory(hre);
    cryptoswap = await getCryptoSwap(factory);
  }

  await hre.deployments.deploy('PoolTWAPOracle', {
    from: deployer,
    args: [cryptoswap.address],
    log: true,
  });

  const vBase = await hre.ethers.getContract('VBase');

  await hre.deployments.deploy('TwapOracle', {
    from: deployer,
    args: [vBase.address, cryptoswap.address],
    log: true,
  });

  console.log('We have deployed the pool TWAP oracle');
};

func.tags = ['PoolTWAPOracle'];
func.id = 'deploy_pool_twap_oracle';

export default func;
