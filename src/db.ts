import { Pool as PgPool } from "pg";
import { Kysely, PostgresDialect, Generated } from "kysely";

export interface Pool {
  id: number;
  address: string;
  token_x_id: number;
  token_y_id: number;
  originated_at: Date;
  sqrt_price: string;
}

export interface Token {
  id: number;
  address: string;
  token_id: string;
  name: string;
  symbol: string;
  decimals: number;
  thumbnail_uri: string;
}

export interface Swap {
  id: number;
  pool_id: string;
  hash: string;
  dx: number;
  dy: number;
  is_x_to_y: boolean;
  sender: string;
  receiver: string;
  timestamp: Date;
}

interface TokenWithGeneratedId extends Omit<Token, "id"> {
  id: Generated<number>;
}

interface SwapWithGeneratedId extends Omit<Swap, "id"> {
  id: Generated<number>;
}

export interface Database {
  pool: Pool;
  token: TokenWithGeneratedId;
  swap: SwapWithGeneratedId;
}

const host = process.env.DB_HOST || "localhost";
const database = process.env.DB_DATABASE || "postgres";
const user = process.env.DB_USER || "postgres";
const password = process.env.DB_PASSWORD || "changeme";
const isSsl = process.env.DB_SSL === "true";

export const db = new Kysely<Database>({
  dialect: new PostgresDialect({
    pool: new PgPool({
      host,
      database,
      user,
      password,
      ssl: isSsl
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
    }),
  }),
});
