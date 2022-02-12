import {eEthereumNetwork} from '../../helpers/types';
import {ZERO_ADDRESS} from '../../helpers/constants';

import {
  IReserveParams,
  IVaultConfiguration,
  IChainlinkOracleConfig,
} from '../../helpers/types';

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
  [eEthereumNetwork.hardhat]: {
    USDC: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    JPY_USD: '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3',
    EUR_USD: '0xb49f677943BC038e9857d61E7d053CaA2C1734C1',
    FEED_REGISTRY: '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf',
  },
  [eEthereumNetwork.kovan]: {
    USDC: '0x9211c6b3BF41A10F78539810Cf5c64e1BB78Ec60',
    JPY_USD: '0xD627B1eF3AC23F1d3e576FA6206126F3c1Bd0942',
    EUR_USD: '0x0c15Ab9A0DB086e062194c273CC79f41597Bbf13',
    FEED_REGISTRY: '0xAa7F6f7f507457a1EE157fE97F6c7DB2BEec5cD0',
  },
  [eEthereumNetwork.main]: {
    USDC: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    JPY_USD: '0xBcE206caE7f0ec07b545EddE332A47C2F75bbeb3',
    EUR_USD: '0xb49f677943BC038e9857d61E7d053CaA2C1734C1',
    FEED_REGISTRY: '0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf',
  },
};

// ----------------
// Integrations
// ----------------

// at the time of writing (Feb 2022), the current factory contract is 0xF18056Bbd320E96A48e3Fbf8bC061322531aac99
// but it could change, if so, use the address provider contract at 0x0000000022d53366457f9d5e68ec105046fc4383
// ref: https://discord.com/channels/729808684359876718/729812922649542758/920105496546013204
// update for v2 factory: call get_address(6) to get the v2 factory
export const CURVE_FACTORY_MAINNET =
  '0xF18056Bbd320E96A48e3Fbf8bC061322531aac99';

export const integrations = {
  [eEthereumNetwork.hardhat]: {
    AAVE_CONTRACTS_GATEWAY: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
    CURVE_FACTORY_CONTRACT: CURVE_FACTORY_MAINNET, // reference to mainnet because we fork mainnet
  },
  [eEthereumNetwork.kovan]: {
    AAVE_CONTRACTS_GATEWAY: '0x88757f2f99175387aB4C6a4b3067c77A695b0349',
    CURVE_FACTORY_CONTRACT: ZERO_ADDRESS,
  },
  [eEthereumNetwork.main]: {
    AAVE_CONTRACTS_GATEWAY: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
    CURVE_FACTORY_CONTRACT: CURVE_FACTORY_MAINNET,
  },
};

// ----------------
// RESERVE-SPECIFIC PARAMS
// --

export const VaultConfig: IVaultConfiguration = {
  MarketId: 'Increment finance reserve Module V0',

  ReserveAssets: {
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
  Parameterization: {
    USDC: strategyUSDC,
  },
  ChainlinkOracles: chainlinkOracles,
  Integrations: integrations,
};

// ----------------
// Oracle--SPECIFIC PARAMS
// ----------------

export const ChainlinkOracleConfig: IChainlinkOracleConfig = {
  ChainlinkOracles: chainlinkOracles,
};
