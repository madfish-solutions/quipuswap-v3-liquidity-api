### QuipuSwap V3 Liquidity Pools Stats

A small backend service to fetch QuipuSwap V3 liquidity pools stats from the PostgreSQL database populated by the DipDup-based indexer.
The service is written in TypeScript / Nodejs and uses the following libraries

- Taquito (Tezos client)
- Kysely (SQL query builder)
- memoizee (memoization library)

### Running the service

To run the service, you need to have Nodejs installed. Then, install the dependencies with

```bash
npm install
```

or with yarn

```bash
yarn
```

Then, run the service with

```bash
npm run start
```

or with yarn

```bash
yarn start
```
