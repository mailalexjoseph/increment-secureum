import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {eEthereumNetwork} from '../helpers/types';

export const impersonateAccountsHardhat = async (
  accounts: string[],
  hre: HardhatRuntimeEnvironment
) => {
  if (process.env.TENDERLY === 'true') {
    return;
  }
  // eslint-disable-next-line no-restricted-syntax
  for (const account of accounts) {
    // eslint-disable-next-line no-await-in-loop
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [account],
    });
  }
};

export const getEthereumNetworkFromHRE = (hre: HardhatRuntimeEnvironment) => {
  const currentNetworkName: string = hre.network.name;
  const currentNetworkNameTypeCasted: eEthereumNetwork = (<any>(
    eEthereumNetwork
  ))[currentNetworkName];
  return currentNetworkNameTypeCasted;
};
