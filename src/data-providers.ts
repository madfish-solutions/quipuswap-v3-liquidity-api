import axios from "axios";
import BigNumber from "bignumber.js";
import { db, Token } from "./db";
import { tezos } from "./tezos";

const FACTORY =
  process.env.FACTORY_ADDRESS || "KT1JNNMMGyNNy36Zo6pcgRTMLUZyqRrttMZ4";
const EXCHANGE_RATES_API =
  process.env.EXCHANGE_RATES_API ||
  "https://api.templewallet.com/api/exchange-rates";

export function fetchAllTokens() {
  return db.selectFrom("token").selectAll().execute();
}

export function fetchAllPools() {
  return db
    .selectFrom("pool")
    .selectAll()
    .orderBy("pool.originated_at", "desc")
    .execute();
}

export function fetchAllExchangeRates() {
  return axios
    .get<
      Array<{
        tokenAddress: string;
        exchangeRate: string;
        tokenId: number | undefined;
      }>
    >(EXCHANGE_RATES_API)
    .then((res) => res.data);
}

export async function fetchTokenById(id: number) {
  const allTokens = await fetchAllTokens();
  const token = allTokens.find((token) => token.id === id);

  if (!token) {
    throw new Error("failed to find token with id: " + id);
  }

  return token;
}

export async function fetchDevFee() {
  const contract = await tezos.contract.at(FACTORY);
  const storage = await contract.storage<{
    dev_fee_bps: BigNumber;
  }>();

  return storage.dev_fee_bps.dividedBy(10000);
}

export async function fetchPoolStorage(poolAddress: string) {
  const contract = await tezos.contract.at(poolAddress);
  const storage = await contract.storage<{
    liquidity: BigNumber;
    constants: {
      fee_bps: BigNumber;
    };
  }>();

  return {
    liquidity: storage.liquidity,
    fee: storage.constants.fee_bps.div(10000),
  };
}

export async function fetchBlock() {
  const block = await tezos.rpc.getBlock();
  return block;
}

export async function fetchTokenBalance(token: Token, poolAddress: string) {
  const contract = await tezos.contract.at(token.address);
  const isFA2 = token.token_id !== null;

  let nat: BigNumber | undefined;

  if (isFA2) {
    try {
      const response = await contract.views
        .balance_of([{ owner: poolAddress, token_id: token.token_id }])
        .read();
      nat = response[0].balance;
    } catch (e) {
      return new BigNumber(0);
    }
  } else {
    try {
      nat = await contract.views.getBalance(poolAddress).read();
    } catch {
      return new BigNumber(0);
    }
  }

  return nat || new BigNumber(0);
}
