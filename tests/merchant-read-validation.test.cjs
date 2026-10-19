const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { createMerchantReadServices } = loadSource('src/lib/merchantGraphqlReads.ts', {
  '@/lib/supabase/admin': {},
  '@/lib/catalogServer': { productFromRow: row => ({ id: row.id }) },
  '@/lib/productModelHistory': { productModelVersions: () => [] },
  '@/lib/kitchenMarketplaceServer': {},
  '@/lib/kitchenAssembly': {},
});

test('product reads reject malformed JSON store IDs before querying ownership and retain owner scoping for valid IDs', async () => {
  for (const storeIds of [null, [], [null], [5], [true], [{}], ['store', 'other'], ['store']]) {
    const calls = [];
    const db = { from(table) {
      calls.push(['from', table]);
      return {
        select() { return this; },
        eq(key, value) { calls.push([table, key, value]); return this; },
        order() { return this; },
        async maybeSingle() { return { data: { id: 'model', store_ids: storeIds }, error: null }; },
        async limit() { return { data: [{ id: 'store' }], error: null }; },
        async range() { return { data: [], error: null }; },
      };
    } };
    const result = createMerchantReadServices(db).productDetails('verified-owner', 'product');
    if (Array.isArray(storeIds) && storeIds.length === 1 && storeIds[0] === 'store') {
      assert.equal((await result).product.id, 'model');
      assert.ok(calls.some(call => call[0] === 'merchant_stores' && call[1] === 'id' && call[2] === 'store'));
      assert.ok(calls.some(call => call[0] === 'merchant_stores' && call[1] === 'owner_id' && call[2] === 'verified-owner'));
      assert.ok(calls.some(call => call[0] === 'merchant_stores' && call[1] === 'active' && call[2] === true));
    } else {
      await assert.rejects(result, error => error.extensions.code === 'NOT_FOUND');
      assert.equal(calls.filter(call => call[0] === 'from').length, 1);
    }
  }
});
