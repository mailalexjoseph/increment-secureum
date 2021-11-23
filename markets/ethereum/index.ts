import {IPerpetualConfiguration, eEthereumNetwork} from '../../helpers/types';
import {utils} from 'ethers';
import {ZERO_ADDRESS} from '../../helpers/constants';

import {
  IReserveParams,
  iVAMMConfig,
  IVaultConfiguration,
} from '../../helpers/types';

// ----------------
// Parameterization
// ----------------

const vAMMConfig: iVAMMConfig = {
  QuoteAssetReserve: utils.parseEther('100000000'),
  BaseAssetReserve: utils.parseEther('900000'),
};

// ----------------
// Reserve Assets
// ----------------

const strategyUSDC: IReserveParams = {
  baseLTVAsCollateral: 'tbd',
  liquidationThreshold: 'tbd',
  reserveDecimals: '6',
  reserveFactor: 'tbd',
};

// ----------------
// Chainlink Oracles
// ----------------

const chainlinkOracles = {
  [eEthereumNetwork.coverage]: {
    USDC: ZERO_ADDRESS,
    JPY_USD: ZERO_ADDRESS,
    FEED_REGISTRY: ZERO_ADDRESS,
  },
  [eEthereumNetwork.hardhat]: {
    USDC: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    JPY_USD: '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3',
    FEED_REGISTRY: '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf',
  },
  [eEthereumNetwork.localhost]: {
    USDC: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    JPY_USD: '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3',
    FEED_REGISTRY: '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf',
  },
  [eEthereumNetwork.kovan]: {
    USDC: '0x9211c6b3BF41A10F78539810Cf5c64e1BB78Ec60',
    JPY_USD: '0xD627B1eF3AC23F1d3e576FA6206126F3c1Bd0942',
    FEED_REGISTRY: '0xAa7F6f7f507457a1EE157fE97F6c7DB2BEec5cD0',
  },
  [eEthereumNetwork.main]: {
    USDC: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    JPY_USD: '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3',
    FEED_REGISTRY: '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf',
  },
};

// ----------------
// Integrations
// ----------------

const integrations = {
  [eEthereumNetwork.coverage]: {
    LENDING_POOL_ADDRESS_PROVIDER: ZERO_ADDRESS,
  },
  [eEthereumNetwork.hardhat]: {
    LENDING_POOL_ADDRESS_PROVIDER: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
  },
  [eEthereumNetwork.localhost]: {
    LENDING_POOL_ADDRESS_PROVIDER: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
  },

  [eEthereumNetwork.kovan]: {
    LENDING_POOL_ADDRESS_PROVIDER: '0x88757f2f99175387aB4C6a4b3067c77A695b0349',
  },
  [eEthereumNetwork.main]: {
    LENDING_POOL_ADDRESS_PROVIDER: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
    CRYPTOSWAP_EURS_SWAP: '0x98a7F18d4E56Cfe84E3D081B40001B3d5bD3eB8B',
    CRYPTOSWAP_EURS_TOKEN: '0x3D229E1B4faab62F621eF2F6A610961f7BD7b23B',
  },
};

// ----------------
// RESERVE-SPECIFIC PARAMS
// --

export const VaultConfig: IVaultConfiguration = {
  MarketId: 'Increment finance reserve Module V0',

  ReserveAssets: {
    [eEthereumNetwork.coverage]: {
      USDC: ZERO_ADDRESS,
    },
    [eEthereumNetwork.hardhat]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
    [eEthereumNetwork.localhost]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
    [eEthereumNetwork.kovan]: {
      USDC: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
    },
    [eEthereumNetwork.main]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
  },
  Parameterization: {
    USDC: strategyUSDC,
  },
  ChainlinkOracles: chainlinkOracles,
  Integrations: integrations,
};

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const PerpConfig: IPerpetualConfiguration = {
  MarketId: 'Increment finance vAMM market',
  VAMMConfig: vAMMConfig,
  ReserveAssets: {
    [eEthereumNetwork.coverage]: {
      USDC: ZERO_ADDRESS,
    },
    [eEthereumNetwork.hardhat]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
    [eEthereumNetwork.localhost]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
    [eEthereumNetwork.kovan]: {
      USDC: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
    },
    [eEthereumNetwork.main]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
  },
  ChainlinkOracles: chainlinkOracles,
};

export default PerpConfig;
