type AsyncFunction = (...args: any[]) => Promise<any>;

type SyncReturnType<T extends AsyncFunction> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : any;

type SWRCache<Fetcher extends AsyncFunction> = {
  get: (...args: any[]) => Promise<SyncReturnType<Fetcher>>;
};

type CacheItem<T> = {
  item: T;
  validUntil: Date;
};

export function makeSwrCache<F extends AsyncFunction>(
  fetcher: F,
  ttl: number
): SWRCache<F> {
  const cache = new Map<string, CacheItem<Promise<SyncReturnType<F>>>>();
  const setCache = (key: string, item: Promise<SyncReturnType<F>>) => {
    cache.set(key, {
      validUntil: new Date(new Date().getTime() + ttl),
      item: item.catch((err) => {
        cache.delete(key);
        throw err;
      }),
    });
  };

  const get = (...args: any[]) => {
    const key = JSON.stringify(args);
    const cachedItem = cache.get(key);

    if (cachedItem) {
      if (cachedItem.validUntil >= new Date()) {
        return cachedItem.item;
      }

      const oldItem = cachedItem.item;
      setCache(key, fetcher(...args));
      return oldItem;
    }

    const newItem = fetcher(...args);
    setCache(key, newItem);
    return newItem;
  };

  return {
    get,
  };
}
