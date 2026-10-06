const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { createCatalogCache } = loadSource('src/lib/catalogCache.ts');

test('public page/API snapshots survive development module reloads and pick up refreshed reader implementations', async () => {
  const previousEnv = process.env.NODE_ENV, previousCache = global.__tavilgaPublicCatalog;
  process.env.NODE_ENV = 'development'; delete global.__tavilgaPublicCatalog;
  let now = 0, oldReads = 0, newReads = 0, stores = 0, counts = 0;
  const mocks = readProducts => ({
    '@/lib/catalogServer': { readProducts },
    '@/lib/catalogCache': { createCatalogCache: read => createCatalogCache(read, 15000, () => now) },
    '@/lib/storeDirectory': {
      readStoreDirectory: async () => { stores++; return [{ id: 'store' }]; },
      readStoreProductCounts: async () => { counts++; return new Map([['store', 32]]); },
    },
  });
  try {
    const home = loadSource('src/lib/publicCatalog.ts', mocks(async () => { oldReads++; return ['old']; }));
    assert.deepEqual(await home.readCachedProducts(), ['old']);
    const api = loadSource('src/lib/publicCatalog.ts', mocks(async () => { newReads++; return ['new']; }));
    assert.equal((await api.readCatalogSnapshot()).cache, 'hit');
    assert.equal(oldReads, 1); assert.equal(newReads, 0);
    assert.deepEqual((await api.readCatalogSnapshot(true)).value, ['new']);
    assert.deepEqual(await home.readCachedProducts(), ['new']);
    assert.equal(newReads, 1);
    await Promise.all([home.readCachedStoreDirectory(), api.readCachedStoreDirectory(), api.readCachedDirectoryStore('store')]);
    await Promise.all([home.readCachedStoreProductCounts(), api.readCachedStoreProductCounts()]);
    assert.equal(stores, 1); assert.equal(counts, 1);
    now = 15000; await home.readCachedProducts(); assert.equal(oldReads, 1); assert.equal(newReads, 2);
  } finally {
    if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv;
    if (previousCache === undefined) delete global.__tavilgaPublicCatalog; else global.__tavilgaPublicCatalog = previousCache;
  }
});
