import BigNumber from "bignumber.js";
import { Pool, Token } from "./db";

type Nullable<Type> = Type | null;

export interface BlockInfo {
  level: number;
  hash: string;
  timestamp: string;
}

export interface TokenMetadata {
  decimals: number;
  symbol: string;
  name: string;
  thumbnailUri: string;
}

export interface TokenMetadataResponse {
  token_id?: string;
  name: string;
  symbol: string;
  decimals: number;
  thumbnailUri: string;
}

export enum Standard {
  Fa12 = "FA12",
  Fa2 = "FA2",
}

export interface FrontendToken<fa2TokenId = string> {
  type: Standard;
  contractAddress: string;
  fa2TokenId?: fa2TokenId;
  isWhitelisted: Nullable<boolean>;
  metadata: TokenMetadata;
}

export enum PoolType {
  STABLESWAP = "STABLESWAP",
  DEX_TWO = "DEX_TWO",
  TEZ_TOKEN = "TEZ_TOKEN",
  TOKEN_TOKEN = "TOKEN_TOKEN",
  UNISWAP = "UNISWAP",
}

export interface TokensInfo {
  token: FrontendToken<string>;
  atomicTokenTvl: string;
  exchangeRate?: string;
}

export interface LiquidityItem {
  contractAddress: string;
  id: string;
  type: PoolType;
  tokensInfo: Array<TokensInfo>;
  apr: Nullable<number>;
  maxApr: Nullable<number>;
  poolLabels: Array<string>;
  volumeForWeek: Nullable<string>;
  volumeForDay: Nullable<string>;
  volumeForAllTime: Nullable<string>;

  totalSupply: string;
  opportunities: [];
  tvlInUsd: string;

  accordanceSlug?: string;
  nextDelegate?: string;
  currentDelegate?: string;
  feesRate: string;
  feesForDay: string;
}

export interface LiquidityItemResponse {
  item: LiquidityItem;
  blockInfo: BlockInfo;
}

interface Stats {
  totalValueLocked: string;
  maxApr: number;
  poolsCount: number;
}

export interface StatsInfo {
  stats: Stats;
  blockInfo: BlockInfo;
}

export interface StatsInput {
  poolsCount: number;
  tvl: number;
  dexInfo: Array<LiquidityItemResponse>;
}

export type VolumePair = {
  totalDx: BigNumber;
  totalDy: BigNumber;
};

export type VolumeStats = {
  week: VolumePair;
  day: VolumePair;
  allTime: VolumePair;
};

export type VolumeStatsUsd = {
  week: BigNumber;
  day: BigNumber;
  allTime: BigNumber;
};

export interface PoolStat extends Pool {
  volume: VolumeStats;

  tokenX: Token;
  tokenY: Token;

  tokenXSupply: BigNumber;
  tokenYSupply: BigNumber;

  devFee: BigNumber;
  lpFee: BigNumber;
  liquidity: BigNumber;
}
