const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { createCatalogCache } = loadSource('src/lib/catalogCache.ts');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

test('catalog snapshots expire 15 seconds after a successful load and explicit refresh bypasses them', async () => {
  let time = 0, reads = 0;
  const cache = createCatalogCache(async () => ++reads, 15000, () => time);
  assert.deepEqual(await cache.get(), { value: 1, cache: 'miss' });
  time = 14999;
  assert.deepEqual(await cache.get(), { value: 1, cache: 'hit' });
  time = 15000;
  assert.deepEqual(await cache.get(), { value: 2, cache: 'miss' });
  assert.deepEqual(await cache.get(true), { value: 3, cache: 'refresh' });
  assert.deepEqual(await cache.get(), { value: 3, cache: 'hit' });
});

test('concurrent cold or forced requests share one database read', async () => {
  const queue = [], cache = createCatalogCache(() => { const d = deferred(); queue.push(d); return d.promise; });
  const first = cache.get(), others = Array.from({ length: 8 }, () => cache.get());
  await Promise.resolve();
  assert.equal(queue.length, 1);
  queue[0].resolve(['catalog']);
  assert.equal((await first).cache, 'miss');
  assert.ok((await Promise.all(others)).every(result => result.cache === 'coalesced'));
  const forced = cache.get(true), forcedSecond = cache.get(true);
  await Promise.resolve();
  assert.equal(queue.length, 2);
  queue[1].resolve(['updated']);
  assert.deepEqual((await forced).value, ['updated']);
  assert.deepEqual((await forcedSecond).value, ['updated']);
});

test('a forced refresh arriving during an ordinary read waits for a new read and coalesces repeated refreshes', async () => {
  const queue = [], cache = createCatalogCache(() => { const d = deferred(); queue.push(d); return d.promise; });
  const ordinary = cache.get(), fresh = cache.get(true), freshAgain = cache.get(true);
  await Promise.resolve();
  queue[0].resolve('old');
  assert.equal((await ordinary).value, 'old');
  await Promise.resolve();
  assert.equal(queue.length, 2);
  queue[1].resolve('new');
  assert.equal((await fresh).value, 'new');
  assert.equal((await freshAgain).value, 'new');
  assert.equal((await cache.get()).value, 'new');
});

test('errors never become cached catalog data and an expired snapshot cannot mask an outage', async () => {
  let fail = false, now = 0, reads = 0;
  const cache = createCatalogCache(async () => { reads++; if (fail) throw Error('offline'); return []; }, 15000, () => now);
  await cache.get();
  now = 15000;
  fail = true;
  await assert.rejects(cache.get(), /offline/);
  await assert.rejects(cache.get(), /offline/);
  fail = false;
  assert.deepEqual((await cache.get()).value, []);
  assert.equal(reads, 4);
});

test('the products endpoint reports cache timing, keeps HTTP caches disabled and bypasses snapshots for fresh=1', async () => {
  let reads = 0, fail = false;
  const route = loadSource('src/app/api/products/route.ts', {
    '@/lib/catalogServer': { readProducts: async () => { reads++; if (fail) throw Error('offline'); return [{ id: String(reads) }]; } },
  });
  const request = query => new Request('http://localhost/api/products' + query);
  const first = await route.GET(request(''));
  assert.match(first.headers.get('server-timing'), /desc="miss"/);
  assert.equal(first.headers.get('cache-control'), 'no-store');
  const second = await route.GET(request(''));
  assert.match(second.headers.get('server-timing'), /desc="hit"/);
  assert.equal(reads, 1);
  const fresh = await route.GET(request('?fresh=1'));
  assert.equal((await fresh.json()).products[0].id, '2');
  assert.match(fresh.headers.get('server-timing'), /desc="refresh"/);
  fail = true;
  const broken = await route.GET(request('?fresh=1'));
  assert.equal(broken.status, 503);
  assert.match(broken.headers.get('cache-control'), /no-store/);
});

function catalogDb(rows) {
  const cursors = [];
  return { cursors, from() {
    let after = '';
    return { select() { return this; }, is() { return this; }, order() { return this; }, limit() { return this; },
      gt(field, id) { assert.equal(field, 'id'); after = id; return this; },
      then(resolve) { cursors.push(after); resolve({ data: rows.filter(row => row.id > after).slice(0, 500), error: null }); },
    };
  } };
}

test('small catalogs avoid the empty-page round trip while larger catalogs still paginate fully', async () => {
  const { readProducts } = loadSource('src/lib/catalogServer.ts', { '@/lib/catalogValidation': { parseProduct: item => item } });
  for (const [count, expectedReads] of [[0, 1], [32, 1], [500, 2], [501, 2], [1001, 3]]) {
    const rows = Array.from({ length: count }, (_, i) => ({ id: String(i + 1).padStart(5, '0'), product_id: 'product' + i, in_stock: 1 }));
    const db = catalogDb(rows);
    assert.equal((await readProducts(db)).length, count);
    assert.equal(db.cursors.length, expectedReads);
  }
});
