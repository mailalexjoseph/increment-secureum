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
    USDC: ZERO_ADDRESS,
  },
  [eEthereumNetwork.kovan]: {
    USDC: '0x64EaC61A2DFda2c3Fa04eED49AA33D021AeC8838',
  },
  [eEthereumNetwork.main]: {
    USDC: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
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
    JPY_USD: ZERO_ADDRESS,
  },
  [eEthereumNetwork.kovan]: {
    JPY_USD: '0x64EaC61A2DFda2c3Fa04eED49AA33D021AeC8838',
  },
  [eEthereumNetwork.main]: {
    JPY_USD: '0x986b5E1e1755e3C2440e960477f25201B0a8bbD4',
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
    lendingPoolAddressProvider: ZERO_ADDRESS,
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
    [eEthereumNetwork.hardhat]: {
      USDC: ZERO_ADDRESS,
    },
    [eEthereumNetwork.coverage]: {
      USDC: ZERO_ADDRESS,
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
