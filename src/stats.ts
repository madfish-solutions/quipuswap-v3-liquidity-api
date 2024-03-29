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
  VolumePair,
  VolumeStatsUsd,
} from "./types";
import { wtezAddress } from "./config";

const { sum } = db.fn;

const X80_FORMAT_PRECISION_POWER = 80;
const X80_FORMAT_PRECISION = new BigNumber(2).pow(X80_FORMAT_PRECISION_POWER);

const allTokensCache = makeSwrCache(fetchAllTokens, 30000);
const allPoolsCache = makeSwrCache(fetchAllPools, 30000);
const allExchangeRatesCache = makeSwrCache(fetchAllExchangeRates, 60000);
const tokenBalanceCache = makeSwrCache(fetchTokenBalance, 30000);
const allPoolStatsCache = makeSwrCache(getPoolStats, 30000);
const devFeeCache = makeSwrCache(fetchDevFee, 60000 * 60 * 6); // not changed too often
const poolStorageCache = makeSwrCache(fetchPoolStorage, 30000);
const blockCache = makeSwrCache(fetchBlock, 3000);

export async function getPoolStats(): Promise<PoolStat[]> {
  const pools = await allPoolsCache.get();

  return Promise.all(
    pools.map(async (pool) => {
      const [allTimeSwaps, weeklySwaps, dailySwaps] = await Promise.all([
        getVolume(pool.address),
        getVolume(pool.address, 7),
        getVolume(pool.address, 1),
      ]);

      const [tokenX, tokenY, poolStorage, devFee] = await Promise.all([
        getTokenById(pool.token_x_id),
        getTokenById(pool.token_y_id),
        poolStorageCache.get(pool.address),
        devFeeCache.get(),
      ]);

      const [tokenXSupply, tokenYSupply] = await Promise.all([
        tokenBalanceCache.get(tokenX, pool.address),
        tokenBalanceCache.get(tokenY, pool.address),
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
        volume: {
          allTime: allTimeSwaps,
          week: weeklySwaps,
          day: dailySwaps,
        },
      };
    })
  );
}

async function getVolume(poolAddress: string, days?: number) {
  const base = db
    .selectFrom("swap")
    .select(sum<string>("dx").as("totalDx"))
    .select(sum<string>("dy").as("totalDy"))
    .where("pool_id", "=", poolAddress);

  const full =
    days !== undefined
      ? base.where(
          "timestamp",
          ">",
          new Date(Date.now() - days * 24 * 60 * 60 * 1000)
        )
      : base;

  const aggregation = await full.executeTakeFirst();
  if (!aggregation) {
    throw new Error("failed to aggregate swaps");
  }

  const { totalDx, totalDy } = aggregation;
  return {
    totalDx: new BigNumber(totalDx || 0),
    totalDy: new BigNumber(totalDy || 0),
  };
}

async function getTokenById(id: number) {
  const allTokens = await allTokensCache.get();
  const token = allTokens.find((token) => token.id === id);
  if (!token) {
    throw new Error("failed to find token with id: " + id);
  }

  return token;
}

export async function getLiquidityItems(): Promise<LiquidityItemResponse[]> {
  const poolStats = await allPoolStatsCache.get();
  const allExchangeRates = await allExchangeRatesCache.get();
  const block = await blockCache.get();
  const tezExchangeRate =
    allExchangeRates[allExchangeRates.length - 1].exchangeRate;

  const getExchangeRate = (token: Token) => {
    if (token.address === wtezAddress) {
      return new BigNumber(tezExchangeRate);
    }

    return new BigNumber(
      allExchangeRates.find(
        (exchangeRate) =>
          exchangeRate.tokenAddress === token.address &&
          (token.token_id !== null
            ? exchangeRate.tokenId === Number(token.token_id)
            : true)
      )?.exchangeRate || "0"
    );
  };

  return poolStats.map((poolStat) => {
    const tokenX = poolStat.tokenX;
    const tokenY = poolStat.tokenY;
    const sqrtPrice = new BigNumber(poolStat.sqrt_price);
    const priceDecimals = tokenY.decimals - tokenX.decimals;
    const normalizedPrice = convertToAtomicPrice(sqrtPrice).shiftedBy(
      -priceDecimals
    );
    const originalTokenXExchangeRate = getExchangeRate(tokenX);
    const originalTokenYExchangeRate = getExchangeRate(tokenY);
    const tokenXExchangeRate = originalTokenXExchangeRate.isEqualTo(0)
      ? originalTokenYExchangeRate.multipliedBy(normalizedPrice)
      : originalTokenXExchangeRate;
    const tokenYExchangeRate = originalTokenYExchangeRate.isEqualTo(0)
      ? originalTokenXExchangeRate.dividedBy(normalizedPrice)
      : originalTokenYExchangeRate;

    const tokenXDecimalsDenominator = new BigNumber(10).pow(tokenX.decimals);
    const tokenYDecimalsDenominator = new BigNumber(10).pow(tokenY.decimals);

    const {
      week: volumePerWeekUsd,
      day: volumePerDayUsd,
      allTime: volumeAllTimeUsd,
    } = getUsdVolumes(
      poolStat,
      tokenXExchangeRate,
      tokenXDecimalsDenominator,
      tokenYExchangeRate,
      tokenYDecimalsDenominator
    );

    const periodsPerYear = new BigNumber(365).div(7);
    const tvlUsd = poolStat.tokenXSupply
      .div(tokenXDecimalsDenominator)
      .times(tokenXExchangeRate)
      .plus(
        poolStat.tokenYSupply
          .div(tokenYDecimalsDenominator)
          .times(tokenYExchangeRate)
      );
    const apr = volumePerWeekUsd
      .times(periodsPerYear)
      .times(poolStat.lpFee)
      .times(new BigNumber(1).minus(poolStat.devFee))
      .div(tvlUsd)
      .times(100);

    const liquidityItem: LiquidityItem = {
      id: poolStat.id.toFixed(0),
      contractAddress: poolStat.address,
      apr: apr.toNumber(),
      maxApr: apr.toNumber(),
      feesRate: "0",
      feesForDay: volumePerDayUsd
        .times(poolStat.lpFee)
        .times(new BigNumber(1).minus(poolStat.devFee))
        .toFixed(),
      poolLabels: [],
      opportunities: [],
      type: PoolType.UNISWAP,
      volumeForWeek: volumePerWeekUsd.toFixed(),
      volumeForDay: volumePerDayUsd.toFixed(),
      volumeForAllTime: volumeAllTimeUsd.toFixed(),
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

function getUsdVolumes(
  poolStat: PoolStat,
  tokenXExchangeRate: BigNumber,
  tokenXDecimalsDenominator: BigNumber,
  tokenYExchangeRate: BigNumber,
  tokenYDecimalsDenominator: BigNumber
): VolumeStatsUsd {
  const calculateVolume = (pair: VolumePair) =>
    BigNumber.max(
      pair.totalDx
        .div(tokenXDecimalsDenominator)
        .multipliedBy(tokenXExchangeRate),
      pair.totalDy
        .div(tokenYDecimalsDenominator)
        .multipliedBy(tokenYExchangeRate)
    );

  const { week, day, allTime } = poolStat.volume;
  return {
    week: calculateVolume(week),
    day: calculateVolume(day),
    allTime: calculateVolume(allTime),
  };
}

function makeTokenInfo(
  token: Token,
  tvl: string,
  exchangeRate: BigNumber
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
    exchangeRate: exchangeRate.toFixed(),
  };
}

export const convertToAtomicPrice = (sqrtPrice: BigNumber) => {
  const defaultDecimalPlaces = BigNumber.config().DECIMAL_PLACES;
  BigNumber.config({ DECIMAL_PLACES: X80_FORMAT_PRECISION_POWER });
  const price = new BigNumber(sqrtPrice).div(X80_FORMAT_PRECISION).pow(2);
  BigNumber.config({ DECIMAL_PLACES: defaultDecimalPlaces });

  return price;
};
