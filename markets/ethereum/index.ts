import {eEthereumNetwork} from '../../helpers/types';
import {BigNumber} from 'ethers';
import {utils} from 'ethers';

import {
  IVaultConfiguration,
  ICryptoSwapConfig,
  IChainlinkOracleConfig,
} from '../../helpers/types';

// ----------------
// CURVE CONFIGURATION
// ----------------

export const cryptoSwapConfig: ICryptoSwapConfig = {
  markets: {
    EUR_USD: {
      _name: 'vEUR/vUSD',
      _symbol: 'EURUSD',
      _coins: ['', ''],
      A: BigNumber.from(5000)
        .mul(2 ** 2)
        .mul(10000),
      gamma: utils.parseEther('0.0001'),
      mid_fee: utils.parseUnits('0.0005', 10),
      out_fee: utils.parseUnits('0.0045', 10),
      allowed_extra_profit: utils.parseUnits('10', 10),
      fee_gamma: utils.parseEther('0.005'),
      adjustment_step: utils.parseEther('0.0000055'),
      admin_fee: utils.parseUnits('5', 9),
      ma_half_time: BigNumber.from(600),
      initial_price: utils.parseEther('0'),
    },
    JPY_USD: {
      _name: 'vJPY/vUSD',
      _symbol: 'JPYUSD',
      _coins: ['', ''],
      A: BigNumber.from(5000)
        .mul(2 ** 2)
        .mul(10000),
      gamma: utils.parseEther('0.0001'),
      mid_fee: utils.parseUnits('0.0005', 10),
      out_fee: utils.parseUnits('0.0045', 10),
      allowed_extra_profit: utils.parseUnits('10', 10),
      fee_gamma: utils.parseEther('0.005'),
      adjustment_step: utils.parseEther('0.0000055'),
      admin_fee: utils.parseUnits('5', 9),
      ma_half_time: BigNumber.from(600),
      initial_price: utils.parseEther('0'),
    },
  },
};

// ----------------
// Chainlink Oracles
// ----------------

export const chainlinkOracles: IChainlinkOracleConfig = {
  priceOracles: {
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
  },
};

// ----------------
// Integrations
// ----------------

// at the time of writing (Feb 2022), the current factory contract is 0xF18056Bbd320E96A48e3Fbf8bC061322531aac99
// but it could change, if so, use the address provider contract at 0x0000000022d53366457f9d5e68ec105046fc4383
// ref: https://discord.com/channels/729808684359876718/729812922649542758/920105496546013204
// update for v2 factory: call get_address(6) to get the v2 factory
const CURVE_FACTORY_MAINNET = '0xF18056Bbd320E96A48e3Fbf8bC061322531aac99';

export const integrations = {
  [eEthereumNetwork.hardhat]: {
    AAVE_CONTRACTS_GATEWAY: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
    CURVE_FACTORY_CONTRACT: CURVE_FACTORY_MAINNET, // reference to mainnet because we fork mainnet
    WETH: '',
  },
  [eEthereumNetwork.kovan]: {
    AAVE_CONTRACTS_GATEWAY: '0x88757f2f99175387aB4C6a4b3067c77A695b0349',
    CURVE_FACTORY_CONTRACT: '',
    WETH: '0xd0A1E359811322d97991E03f863a0C30C2cF029C', // used for cryptoswap
  },
  [eEthereumNetwork.main]: {
    AAVE_CONTRACTS_GATEWAY: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
    CURVE_FACTORY_CONTRACT: CURVE_FACTORY_MAINNET,
    WETH: '',
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
};
