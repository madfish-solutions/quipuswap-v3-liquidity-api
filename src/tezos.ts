import { MichelCodecPacker } from "@taquito/taquito";
import { TezosToolkit } from "@taquito/taquito";
import { localForger } from "@taquito/local-forging";
import { FastRpcClient } from "./fast-rpc";
import { rpcNode } from "./config";

export const tezos = new TezosToolkit(new FastRpcClient(rpcNode) as any);

tezos.setForgerProvider(localForger);
tezos.setPackerProvider(new MichelCodecPacker());
