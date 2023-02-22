import BigNumber from "bignumber.js";

import { makeSwrCache } from "./cache";
import { db, Token } from "./db";
import {
  fetchAllExchangeRates,
  fetchAllPools,
  fetchAllTokens,
  fetchBlock,
  fetchDevFee,
  fetchPoolStorage,
  fetchTokenBalance,
} from "./data-providers";
import {
  LiquidityItem,
  LiquidityItemResponse,
  PoolStat,
  PoolType,
  Standard,
  TokensInfo,
} from "./types";

const { sum } = db.fn;

const allTokensCache = makeSwrCache(fetchAllTokens, 30000);
const allPoolsCache = makeSwrCache(fetchAllPools, 30000);
const allExchangeRatesCache = makeSwrCache(fetchAllExchangeRates, 60000);
const tokenBalanceCache = makeSwrCache(fetchTokenBalance, 30000);
const allPoolStatsCache = makeSwrCache(getPoolStats, 30000);
const devFeeCache = makeSwrCache(fetchDevFee, 60000 * 60 * 6); // not changed too often
const poolStorageCache = makeSwrCache(fetchPoolStorage, 30000);
const blockCache = makeSwrCache(fetchBlock, 3000);

async function getTokenById(id: number) {
  const allTokens = await allTokensCache.get();
  const token = allTokens.find((token) => token.id === id);
  if (!token) {
    throw new Error("failed to find token with id: " + id);
  }

  return token;
}

export async function getPoolStats(days: number): Promise<PoolStat[]> {
  const pools = await allPoolsCache.get();

  return Promise.all(
    pools.map(async (pool) => {
      const swaps = await db
        .selectFrom("swap")
        .select(sum<string>("dx").as("totalDx"))
        .select(sum<string>("dy").as("totalDy"))
        .where("pool_id", "=", pool.address)
        .where(
          "timestamp",
          ">",
          new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        )
        .executeTakeFirst();

      if (!swaps) {
        throw new Error("failed to aggregate swaps");
      }

      const [tokenX, tokenY, poolStorage, devFee] = await Promise.all([
        getTokenById(pool.token_x_id),
        getTokenById(pool.token_y_id),
        poolStorageCache.get(pool.address),
        devFeeCache.get(),
      ]);

      const [tokenXSupply, tokenYSupply] = await Promise.all([
        tokenBalanceCache.get(tokenX, pool.address),
        tokenBalanceCache.get(tokenX, pool.address),
      ]);

      return {
        ...pool,
        tokenX,
        tokenY,
        tokenXSupply,
        tokenYSupply,
        devFee: devFee,
        lpFee: poolStorage.fee,
        liquidity: poolStorage.liquidity,
        totalDx: new BigNumber(swaps.totalDx || 0),
        totalDy: new BigNumber(swaps.totalDy || 0),
      };
    })
  );
}

function makeTokenInfo(
  token: Token,
  tvl: string,
  exchangeRate: string
): TokensInfo {
  return {
    atomicTokenTvl: tvl,
    token: {
      fa2TokenId: token.token_id,
      contractAddress: token.address,
      isWhitelisted: false, // TBD
      type: token.token_id ? Standard.Fa2 : Standard.Fa12,
      metadata: {
        decimals: token.decimals,
        name: token.name,
        symbol: token.symbol,
        thumbnailUri: token.thumbnail_uri,
      },
    },
    exchangeRate: exchangeRate,
  };
}

export async function getLiquidityItems(): Promise<LiquidityItemResponse[]> {
  const poolStats = await allPoolStatsCache.get(7);
  const allExchangeRates = await allExchangeRatesCache.get();
  const block = await blockCache.get();

  const getExchangeRate = (tokenAddress: string) =>
    allExchangeRates.find(
      (exchangeRate) => exchangeRate.tokenAddress === tokenAddress
    )?.exchangeRate || "0";

  return poolStats.map((poolStat, idx) => {
    const tokenX = poolStat.tokenX;
    const tokenY = poolStat.tokenY;
    const tokenXExchangeRate = getExchangeRate(tokenX.address);
    const tokenYExchangeRate = getExchangeRate(tokenY.address);
    const tokenXDecimalsDenominator = new BigNumber(10).pow(tokenX.decimals);
    const tokenYDecimalsDenominator = new BigNumber(10).pow(tokenY.decimals);
    const volumePerPeriodUsd = poolStat.totalDx
      .div(tokenXDecimalsDenominator)
      .multipliedBy(tokenXExchangeRate);
    const periodsPerYear = new BigNumber(365).div(7);
    const tvlUsd = poolStat.tokenXSupply
      .div(tokenXDecimalsDenominator)
      .times(tokenXExchangeRate)
      .plus(
        poolStat.tokenYSupply
          .div(tokenYDecimalsDenominator)
          .times(tokenYExchangeRate)
      );
    const apr = volumePerPeriodUsd
      .times(periodsPerYear)
      .times(poolStat.lpFee)
      .times(new BigNumber(1).minus(poolStat.devFee))
      .div(tvlUsd);

    const liquidityItem: LiquidityItem = {
      id: idx.toFixed(),
      contractAddress: poolStat.address,
      apr: apr.toNumber(),
      maxApr: apr.toNumber(),
      feesRate: "0",
      poolLabels: [],
      opportunities: [],
      type: PoolType.UNISWAP,
      volumeForWeek: volumePerPeriodUsd.toFixed(),
      totalSupply: poolStat.liquidity.toFixed(),
      tvlInUsd: tvlUsd.toFixed(),
      tokensInfo: [
        makeTokenInfo(
          tokenX,
          poolStat.tokenXSupply.div(tokenXDecimalsDenominator).toFixed(),
          tokenXExchangeRate
        ),
        makeTokenInfo(
          tokenY,
          poolStat.tokenYSupply.div(tokenYDecimalsDenominator).toFixed(),
          tokenYExchangeRate
        ),
      ],
    };

    return {
      item: liquidityItem,
      blockInfo: {
        hash: block.hash,
        timestamp: block.header.timestamp.toString(),
        level: block.header.level,
      },
    };
  });
}
