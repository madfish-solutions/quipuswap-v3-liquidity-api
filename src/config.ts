export const port = process.env.PORT || 3000;

export const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_DATABASE || "postgres",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "changeme",
  isSsl: process.env.DB_SSL === "true",
};

export const factoryAddress =
  process.env.FACTORY_ADDRESS || "KT1JNNMMGyNNy36Zo6pcgRTMLUZyqRrttMZ4";
export const exchangeRatesApiUrl =
  process.env.EXCHANGE_RATES_API ||
  "https://api.templewallet.com/api/exchange-rates";

export const rpcNode =
  process.env.RPC_NODE || "https://uoi3x99n7c.tezosrpc.midl.dev";

export const wtezAddress =
  process.env.WTEZ_ADDRESS || "KT1UpeXdK6AJbX58GJ92pLZVCucn2DR8Nu4b";
