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

  const vEUR = await ethers.getContract('VBase', deployer);
  const vUSD = await ethers.getContract('VQuote', deployer);

  // let cryptoswap;
  // if (hre.network.name == 'kovan') {
  //   cryptoswap = await ethers.getContract('CurveCryptoSwapTest', deployer);
  // } else {
  const factory = await getCryptoSwapFactory(hre);
  const cryptoswap = await getCryptoSwap(factory);
  // }

  const clearingHouse = await ethers.getContract('ClearingHouse', deployer);

  const perpetualArgs = [
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
  const perpetual = await ethers.getContract(perpetualVersionToUse, deployer);

  console.log('We have deployed Perpetual');

  // register vEUR/vUSD in clearingHouse, register perpetual in clearingHouse

  if ((await vEUR.owner()) !== perpetual.address) {
    await (await vEUR.transferOwner(perpetual.address, true)).wait();
  }

  if ((await vUSD.owner()) !== perpetual.address) {
    await (await vUSD.transferOwner(perpetual.address, true)).wait();
  }

  await clearingHouse.allowListPerpetual(perpetual.address);

  console.log('We have registered the Perpetual');
};

func.tags = ['Perpetual'];
func.id = 'deploy_perpetual_contract';
func.dependencies = ['VirtualTokens', 'CurvePool', 'ClearingHouse'];

export default func;
