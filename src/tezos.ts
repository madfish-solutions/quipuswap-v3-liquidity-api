import { MichelCodecPacker } from "@taquito/taquito";
import { TezosToolkit } from "@taquito/taquito";
import { localForger } from "@taquito/local-forging";
import { FastRpcClient } from "./fast-rpc";

const rpcNode = process.env.RPC_NODE || "https://uoi3x99n7c.tezosrpc.midl.dev";

export const tezos = new TezosToolkit(new FastRpcClient(rpcNode) as any);

tezos.setForgerProvider(localForger);
tezos.setPackerProvider(new MichelCodecPacker());
