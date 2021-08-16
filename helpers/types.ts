import {BigNumber} from 'ethers';

export {BigNumber} from 'ethers';

export interface SymbolMap<T> {
  [symbol: string]: T;
}

export type eNetwork = eEthereumNetwork | ePolygonNetwork | eXDaiNetwork;

export enum eEthereumNetwork {
  kovan = 'kovan',
  main = 'main',
  coverage = 'coverage',
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

export enum AavePools {
  proto = 'proto',
  matic = 'matic',
  amm = 'amm',
}

export enum eContractid {
  AggregatorV3Interface = 'AggregatorV3Interface',
  Perpetual = 'Perpetual',
  PerpetualDataProvider = 'PerpetualDataProvider',
}

export type tEthereumAddress = string;
export type tStringTokenBigUnits = string; // 1 ETH, or 10e6 USDC or 10e18 DAI
export type tBigNumberTokenBigUnits = BigNumber;
export type tStringTokenSmallUnits = string; // 1 wei, or 1 basic unit of USDC, or 1 basic unit of DAI
export type tBigNumberTokenSmallUnits = BigNumber;

export interface IReserveParams {
  reserveDecimals: string;
  reserveFactor: string;
  baseLTVAsCollateral: string;
  liquidationThreshold: string;
}

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
  [eEthereumNetwork.coverage]: T;
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

export interface iAssetCommon<T> {
  [key: string]: T;
}

export type iMultiPoolsAssets<T> = iAssetCommon<T>;

/********************** OWN TYPES **************************/

export interface IPerpetualConfiguration {
  MarketId: string;
  ReserveAssets: iEthereumParamsPerNetwork<SymbolMap<tEthereumAddress>>;
  ReservesConfig: iMultiPoolsAssets<IReserveParams>;
  ChainlinkOracles: iEthereumParamsPerNetwork<SymbolMap<tEthereumAddress>>;
  VAMMConfig: iVAMMConfig;
  Integrations: iEthereumParamsPerNetwork<SymbolMap<tEthereumAddress>>;
}

export interface iVAMMConfig {
  QuoteAssetReserve: BigNumber;
  BaseAssetReserve: BigNumber;
}

export type PerpetualConstructorArguments = [
  BigNumber,
  BigNumber,
  tEthereumAddress,
  tEthereumAddress
];

export type SetReserveTokenArguments = [
  tEthereumAddress,
  tEthereumAddress,
  boolean,
  tEthereumAddress
];
