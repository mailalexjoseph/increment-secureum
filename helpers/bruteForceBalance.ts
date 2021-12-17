import {tEthereumAddress} from '../helpers/types';
import {ethers} from 'hardhat';
import env = require('hardhat');
import {utils, constants} from 'ethers';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const encode = (types: any, values: any) =>
  utils.defaultAbiCoder.encode(types, values);

// original code: https://blog.euler.finance/brute-force-storage-layout-discovery-in-erc20-contracts-with-hardhat-7ff9342143ed
export async function findBalancesSlot(
  tokenAddress: tEthereumAddress
): Promise<number> {
  const account = constants.AddressZero;
  const probeA = encode(['uint'], [1]);
  const probeB = encode(['uint'], [2]);
  const token = await ethers.getContractAt('ERC20', tokenAddress);
  for (let i = 0; i < 100; i++) {
    let probedSlot = utils.keccak256(encode(['address', 'uint'], [account, i]));
    // remove padding for JSON RPC
    while (probedSlot.startsWith('0x0'))
      probedSlot = '0x' + probedSlot.slice(3);
    const prev = await env.network.provider.send('eth_getStorageAt', [
      tokenAddress,
      probedSlot,
      'latest',
    ]);
    // make sure the probe will change the slot value
    const probe = prev === probeA ? probeB : probeA;

    await env.network.provider.send('hardhat_setStorageAt', [
      tokenAddress,
      probedSlot,
      probe,
    ]);

    const balance = await token.balanceOf(account);
    // reset to previous value
    await env.network.provider.send('hardhat_setStorageAt', [
      tokenAddress,
      probedSlot,
      prev,
    ]);
    if (balance.eq(ethers.BigNumber.from(probe))) return i;
    console.log(i);
  }
  throw 'Balances slot not found!';
}
