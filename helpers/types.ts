import {BigNumber} from 'ethers';

export {BigNumber} from 'ethers';

export interface SymbolMap<T> {
  [symbol: string]: T;
}

export type eNetwork = eEthereumNetwork | ePolygonNetwork | eXDaiNetwork;

export enum eEthereumNetwork {
  kovan = 'kovan',
  main = 'main',
  hardhat = 'hardhat',
}

export enum ePolygonNetwork {
  matic = 'matic',
  mumbai = 'mumbai',
}

export enum eXDaiNetwork {
  xdai = 'xdai',
}

export enum EthereumNetworkNames {
  kovan = 'kovan',
  ropsten = 'ropsten',
  main = 'main',
  matic = 'matic',
  mumbai = 'mumbai',
  xdai = 'xdai',
}

export enum eContractid {
  AggregatorV3Interface = 'AggregatorV3Interface',
  Perpetual = 'Perpetual',
  PerpetualDataProvider = 'PerpetualDataProvider',
}

export type tEthereumAddress = string;

export type iParamsPerNetwork<T> =
  | iEthereumParamsPerNetwork<T>
  | iPolygonParamsPerNetwork<T>
  | iXDaiParamsPerNetwork<T>;

export interface iParamsPerNetworkAll<T>
  extends iEthereumParamsPerNetwork<T>,
    iPolygonParamsPerNetwork<T>,
    iXDaiParamsPerNetwork<T> {}

export interface iEthereumParamsPerNetwork<T> {
  [eEthereumNetwork.hardhat]: T;
  [eEthereumNetwork.kovan]: T;
  [eEthereumNetwork.main]: T;
}

export interface iPolygonParamsPerNetwork<T> {
  [ePolygonNetwork.matic]: T;
  [ePolygonNetwork.mumbai]: T;
}

export interface iXDaiParamsPerNetwork<T> {
  [eXDaiNetwork.xdai]: T;
}

export interface ITokenAddress {
  [token: string]: tEthereumAddress;
}

/********************** CONTRACT TYPES **************************/

export interface IChainlinkOracleConfig {
  ChainlinkOracles: iEthereumParamsPerNetwork<SymbolMap<tEthereumAddress>>;
}

export interface IVaultConfiguration {
  MarketId: string;
  ReserveAssets: iEthereumParamsPerNetwork<SymbolMap<tEthereumAddress>>;
}
export type CurveCryptoSwapTestConstructorArguments = {
  owner: tEthereumAddress;
  admin_fee_receiver: tEthereumAddress;
  A: BigNumber;
  gamma: BigNumber;
  mid_fee: BigNumber;
  out_fee: BigNumber;
  allowed_extra_profit: BigNumber;
  fee_gamma: BigNumber;
  adjustment_step: BigNumber;
  admin_fee: BigNumber;
  ma_half_time: BigNumber;
  initial_price: BigNumber;
  curve_token: tEthereumAddress;
  reserve_tokens: [tEthereumAddress, tEthereumAddress];
};

export interface ICryptoSwapConfig {
  markets: SymbolMap<CurveCryptoSwap2ETHConstructorArguments>;
}
export type CurveCryptoSwap2ETHConstructorArguments = {
  _name: string[32];
  _symbol: string[10];
  _coins: [tEthereumAddress, tEthereumAddress];
  A: BigNumber;
  gamma: BigNumber;
  mid_fee: BigNumber;
  out_fee: BigNumber;
  allowed_extra_profit: BigNumber;
  fee_gamma: BigNumber;
  adjustment_step: BigNumber;
  admin_fee: BigNumber;
  ma_half_time: BigNumber;
  initial_price: BigNumber;
};
