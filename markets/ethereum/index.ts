import {IPerpetualConfiguration, eEthereumNetwork} from '../../helpers/types';
import {utils} from 'ethers';
import {ZERO_ADDRESS} from '../../helpers/constants';

import {IReserveParams, iVAMMConfig} from '../../helpers/types';

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
// Chainlink Reserve Oracles
// ----------------

const chainlinkReserveAggregator = {
  [eEthereumNetwork.coverage]: {
    USDC: ZERO_ADDRESS,
  },
  [eEthereumNetwork.hardhat]: {
    USDC: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
  },
  [eEthereumNetwork.kovan]: {
    USDC: '0x9211c6b3BF41A10F78539810Cf5c64e1BB78Ec60',
  },
  [eEthereumNetwork.main]: {
    USDC: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
  },
};

// ----------------
// Chainlink Forex Oracles
// ----------------

const chainlinkForexAggregator = {
  [eEthereumNetwork.coverage]: {
    JPY_USD: ZERO_ADDRESS,
  },
  [eEthereumNetwork.hardhat]: {
    JPY_USD: '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3',
  },
  [eEthereumNetwork.kovan]: {
    JPY_USD: '0xD627B1eF3AC23F1d3e576FA6206126F3c1Bd0942',
  },
  [eEthereumNetwork.main]: {
    JPY_USD: '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3',
  },
};

// ----------------
// Integrations
// ----------------

const integrations = {
  [eEthereumNetwork.coverage]: {
    lendingPoolAddressProvider: ZERO_ADDRESS,
  },
  [eEthereumNetwork.hardhat]: {
    lendingPoolAddressProvider: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
  },
  [eEthereumNetwork.kovan]: {
    lendingPoolAddressProvider: '0x88757f2f99175387aB4C6a4b3067c77A695b0349',
  },
  [eEthereumNetwork.main]: {
    lendingPoolAddressProvider: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
  },
};

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const PerpConfig: IPerpetualConfiguration = {
  MarketId: 'Increment finance vAMM market',
  VAMMConfig: vAMMConfig,
  ReservesConfig: {
    USDC: strategyUSDC,
  },
  ReserveAssets: {
    [eEthereumNetwork.coverage]: {
      USDC: ZERO_ADDRESS,
    },
    [eEthereumNetwork.hardhat]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
    [eEthereumNetwork.kovan]: {
      USDC: '0xe22da380ee6B445bb8273C81944ADEB6E8450422',
    },
    [eEthereumNetwork.main]: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
  },
  ChainlinkReserveAggregator: chainlinkReserveAggregator,
  ChainlinkForexAggregator: chainlinkForexAggregator,
  Integrations: integrations,
};

export default PerpConfig;
