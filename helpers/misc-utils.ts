import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {eEthereumNetwork} from '../helpers/types';
import {deployments} from 'hardhat';

import {Contract} from 'ethers';
import {ethers} from 'hardhat';
import {ContractTransaction, ContractReceipt} from 'ethers';

export const waitForTx = async (
  tx: ContractTransaction
): Promise<ContractReceipt> => await tx.wait(1);

export async function setupUsers<T extends {[contractName: string]: Contract}>(
  addresses: string[],
  contracts: T
): Promise<({address: string} & T)[]> {
  const users: ({address: string} & T)[] = [];
  for (const address of addresses) {
    users.push(await setupUser(address, contracts));
  }
  return users;
}

export async function setupUser<T extends {[contractName: string]: Contract}>(
  address: string,
  contracts: T
): Promise<{address: string} & T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user: any = {address};
  for (const key of Object.keys(contracts)) {
    user[key] = contracts[key].connect(await ethers.getSigner(address));
  }
  return user as {address: string} & T;
}

export async function impersonateAccountsHardhat(
  accounts: string[],
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  // eslint-disable-next-line no-restricted-syntax
  for (const account of accounts) {
    // eslint-disable-next-line no-await-in-loop
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [account],
    });
  }
}

export async function fundAccountsHardhat(
  accounts: string[],
  hre: HardhatRuntimeEnvironment,
  amount = '0x56bc75e2d63100000' // 100 ETH
): Promise<void> {
  for (const account of accounts) {
    await hre.network.provider.send('hardhat_setBalance', [account, amount]);
  }
}

let nextBlockTimestamp = 1000000000;
export async function setNextBlockTimestamp(
  hre: HardhatRuntimeEnvironment
): Promise<number> {
  nextBlockTimestamp += 1000000000;

  await hre.network.provider.request({
    method: 'evm_setNextBlockTimestamp',
    params: [nextBlockTimestamp],
  });

  return nextBlockTimestamp;
}

export async function increaseTime(
  hre: HardhatRuntimeEnvironment,
  amount: number
): Promise<void> {
  await hre.network.provider.request({
    method: 'evm_increaseTime',
    params: [amount],
  });
}

export function getEthereumNetworkFromString(String: string): eEthereumNetwork {
  if (Object.values(eEthereumNetwork).some((col: string) => col === String)) {
    return <eEthereumNetwork>String;
  } else {
    try {
      throw new Error(
        `Network ${String} not found in eEthereumNetwork. Mainnet assumed`
      );
    } catch (e) {
      console.log(e);
    }
    return <eEthereumNetwork>'none';
  }
}

export function getEthereumNetworkFromHRE(
  hre: HardhatRuntimeEnvironment
): eEthereumNetwork {
  let networkString: string = hre.network.name;
  if (networkString === 'localhost') {
    networkString = 'hardhat';
  }

  const networkEnum: eEthereumNetwork =
    getEthereumNetworkFromString(networkString);
  return networkEnum;
}

export async function logDeployments(): Promise<void> {
  const allDeployments = await deployments.all();

  for (const [contractName, contractData] of Object.entries(allDeployments)) {
    console.log(`At ${contractData.address} we deployed ${contractName}`);
  }

  /*console.log('Accounts are', {
    namedAccounts: await getNamedAccounts(),
    unnamedAccounts: await getUnnamedAccounts(),
  });*/
}

export async function getLatestTimestamp(
  hre: HardhatRuntimeEnvironment
): Promise<number> {
  const blockNumber = await hre.ethers.provider.getBlockNumber();
  const block = await hre.ethers.provider.getBlock(blockNumber);
  return block.timestamp;
}
