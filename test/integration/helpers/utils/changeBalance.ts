import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {BigNumber, tEthereumAddress} from '../../../../helpers/types';
import {getReserveAddress} from '../../../../helpers/contract-getters';
import {getEthereumNetworkFromHRE} from '../../../../helpers/misc-utils';
import {ethers} from 'hardhat';

import {IERC20} from '../../../../typechain';

// original code: https://kndrck.co/posts/local_erc20_bal_mani_w_hh/
const toBytes32 = (bn: BigNumber) => {
  return ethers.utils.hexlify(ethers.utils.zeroPad(bn.toHexString(), 32));
};

const setStorageAt = async (
  address: tEthereumAddress,
  index: string,
  value: string
) => {
  await ethers.provider.send('hardhat_setStorageAt', [address, index, value]);
  await ethers.provider.send('evm_mine', []); // Just mines to the next block
};

export async function fundAccountWithUSDC(
  hre: HardhatRuntimeEnvironment,
  usdc: IERC20,
  account: tEthereumAddress,
  amount: BigNumber
): Promise<void> {
  if (
    usdc.address != getReserveAddress('USDC', getEthereumNetworkFromHRE(hre))
  ) {
    throw new Error('USDC contract address does not match');
  } else {
    const USDC_ADDRESS = usdc.address;
    const USDC_SLOT = 9; // check for yourself by running 'yarn hardhat run ./scripts/storageSlots.ts' (only works for mainnet!)

    // Get storage slot index
    const index = ethers.utils.solidityKeccak256(
      ['uint256', 'uint256'],
      [account, USDC_SLOT] // key, slot
    );

    // Manipulate local balance (needs to be bytes32 string)
    await setStorageAt(USDC_ADDRESS, index, toBytes32(amount).toString());
  }
}
