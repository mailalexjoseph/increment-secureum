import {
  eEthereumNetwork,
  BigNumber,
  iEthereumParamsPerNetwork,
  SymbolMap,
  tEthereumAddress,
} from '../../../helpers/types';
import {getEthereumNetworkFromString} from '../../../helpers/misc-utils';

import env = require('hardhat');

import {ERC20} from '../../../typechain';
/* Top token holder wallets from etherscan */
const whalesList: iEthereumParamsPerNetwork<SymbolMap<tEthereumAddress[]>> = {
  [eEthereumNetwork.main]: {
    USDC: [
      '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503',
      '0xae2d4617c862309a3d75a0ffb358c7a5009c673f',
      '0xf0b2e1362f2381686575265799c5215ef712162f',
      '0xa522638540dc63aebe0b6aae348617018967cbf6',
      '0x6bb273bf25220d13c9b46c6ed3a5408a3ba9bcc6',
    ],
    DAI: [
      '0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503',
      '0xba12222222228d8ba445958a75a0704d566bf2c8',
      '0x6f6c07d80d0d433ca389d336e6d1febea2489264',
      '0x9cd83be15a79646a3d22b81fc8ddf7b7240a62cb',
      '0xb527a981e1d415af696936b3174f2d7ac8d11369',
    ],
  },
  [eEthereumNetwork.coverage]: {
    USDC: [''],
    DAI: [''],
  },
  [eEthereumNetwork.hardhat]: {
    USDC: [''],
    DAI: [''],
  },
  [eEthereumNetwork.localhost]: {
    USDC: [''],
    DAI: [''],
  },
  [eEthereumNetwork.kovan]: {
    USDC: [''],
    DAI: [''],
  },
};

/* Returns the whale wallet for a given token */
export async function getWhale(
  token: ERC20,
  balance: BigNumber
): Promise<string> {
  const tokenName: string = await token.symbol();
  try {
    const whales: string[] =
      whalesList[getEthereumNetworkFromString('main')][tokenName];

    for (let i = 0; i < whales.length; i++) {
      const whaleBalance: BigNumber = await token.balanceOf(whales[i]);
      if (whaleBalance >= balance) {
        return whales[i];
      }
    }
    throw new Error(
      `All whales for token ${tokenName.toString()},
     in network ${env.network.name} are out of funds.`
    );
  } catch {
    throw new Error(
      `No whales for token ${tokenName.toString()},
     in network ${env.network.name} found.`
    );
  }
}
