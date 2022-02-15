import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {
  getCryptoSwap,
  getCryptoSwapFactory,
} from '../helpers/contracts-getters';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployer} = await hre.getNamedAccounts();

  const factory = await getCryptoSwapFactory(hre);
  const cryptoswap = await getCryptoSwap(factory);

  await hre.deployments.deploy('PoolTWAPOracle', {
    from: deployer,
    args: [cryptoswap.address],
    log: true,
  });

  console.log('We have deployed the pool TWAP oracle');
};

func.tags = ['PoolTWAPOracle'];
func.id = 'deploy_pool_twap_oracle';

export default func;
