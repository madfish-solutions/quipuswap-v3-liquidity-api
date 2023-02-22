import { RpcClient } from "@taquito/rpc";
import debouncePromise from "debounce-promise";
import memoize from "memoizee";

interface RPCOptions {
  block: string;
}

const entrypointsCache: Record<string, any> = {};

export class FastRpcClient extends RpcClient {
  refreshInterval = 1_000;
  memoizeMaxAge = 30_000;

  private latestBlock?: {
    hash: string;
    refreshedAt: number; // timestamp
  };

  async getBlockHash(opts?: RPCOptions) {
    await this.loadLatestBlock(opts);

    if (wantsHead(opts) && this.latestBlock) {
      return this.latestBlock.hash;
    }
    return super.getBlockHash(opts);
  }

  async getBalance(address: string, opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getBalanceMemo(address, opts);
  }

  getBalanceMemo = memoize(super.getBalance.bind(this), {
    normalizer: ([address, opts]) => [address, toOptsKey(opts)].join(""),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getLiveBlocks(opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getLiveBlocksMemo(opts);
  }

  getLiveBlocksMemo = memoize(super.getLiveBlocks.bind(this), {
    normalizer: ([opts]) => toOptsKey(opts),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getStorage(address: string, opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getStorageMemo(address, opts);
  }

  getStorageMemo = memoize(super.getStorage.bind(this), {
    normalizer: ([address, opts]) => [address, toOptsKey(opts)].join(""),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getScript(address: string, opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getScriptMemo(address, opts);
  }

  getScriptMemo = memoize(super.getScript.bind(this), {
    normalizer: ([address, opts]) => [address, toOptsKey(opts)].join(""),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getContract(address: string, opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getContractMemo(address, opts);
  }

  getContractMemo = memoize(super.getContract.bind(this), {
    normalizer: ([address, opts]) => [address, toOptsKey(opts)].join(""),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getEntrypoints(contract: string, opts?: RPCOptions) {
    const cacheKey = `${this.getRpcUrl()}_${contract}`;
    if (entrypointsCache[cacheKey]) {
      return JSON.parse(entrypointsCache[cacheKey]);
    }

    opts = await this.loadLatestBlock(opts);
    const result = await this.getEntrypointsMemo(contract, opts);
    entrypointsCache[cacheKey] = JSON.stringify(result);
    return result;
  }

  getEntrypointsMemo = memoize(super.getEntrypoints.bind(this), {
    normalizer: ([contract, opts]) => [contract, toOptsKey(opts)].join(""),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getManagerKey(address: string, opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getManagerKeyMemo(address, opts);
  }

  getManagerKeyMemo = memoize(super.getManagerKey.bind(this), {
    normalizer: ([address, opts]) => [address, toOptsKey(opts)].join(""),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getDelegate(address: string, opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getDelegateMemo(address, opts);
  }

  getDelegateMemo = memoize(super.getDelegate.bind(this), {
    normalizer: ([address, opts]) => [address, toOptsKey(opts)].join(""),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getBigMapExpr(id: string, expr: string, opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getBigMapExprMemo(id, expr, opts);
  }

  getBigMapExprMemo = memoize(super.getBigMapExpr.bind(this), {
    normalizer: ([id, expr, opts]) => [id, expr, toOptsKey(opts)].join(""),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getDelegates(address: string, opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getDelegatesMemo(address, opts);
  }

  getDelegatesMemo = memoize(super.getDelegates.bind(this), {
    normalizer: ([address, opts]) => [address, toOptsKey(opts)].join(""),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getConstants(opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getConstantsMemo(opts);
  }

  getConstantsMemo = memoize(super.getConstants.bind(this), {
    normalizer: ([opts]) => toOptsKey(opts),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getBlock(opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getBlockMemo(opts);
  }

  getBlockMemo = memoize(super.getBlock.bind(this), {
    normalizer: ([opts]) => toOptsKey(opts),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getBlockHeader(opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getBlockHeaderMemo(opts);
  }

  getBlockHeaderMemo = memoize(super.getBlockHeader.bind(this), {
    normalizer: ([opts]) => toOptsKey(opts),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  async getBlockMetadata(opts?: RPCOptions) {
    opts = await this.loadLatestBlock(opts);
    return this.getBlockMetadataMemo(opts);
  }

  getBlockMetadataMemo = memoize(super.getBlockMetadata.bind(this), {
    normalizer: ([opts]) => toOptsKey(opts),
    promise: true,
    maxAge: this.memoizeMaxAge,
  });

  getChainId = memoize(super.getChainId.bind(this));

  private async loadLatestBlock(opts?: RPCOptions) {
    const head = wantsHead(opts);
    if (!head) return opts;

    if (
      !this.latestBlock ||
      Date.now() - this.latestBlock.refreshedAt > this.refreshInterval
    ) {
      const hash = await this.getLatestBlockHash();
      this.latestBlock = { hash, refreshedAt: Date.now() };
    }

    return { block: this.latestBlock.hash };
  }

  private getLatestBlockHash = debouncePromise(() => super.getBlockHash(), 100);
}

function wantsHead(opts?: RPCOptions) {
  return !opts?.block || opts.block === "head";
}

function toOptsKey(opts?: RPCOptions) {
  return opts?.block ?? "head";
}
