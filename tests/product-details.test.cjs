const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { loadSource } = require('./helpers/load-source.cjs');
const { productModelVersions } = loadSource('src/lib/productModelHistory.ts');
const modelId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const assetId = '11111111-2222-4333-8444-555555555555';
const asset = (role, state = 'available', version = 'v1', extra = {}) => ({
  id: assetId, version_id: version, role, state, byte_size: 100, original_name: null,
  created_at: '2026-10-09T01:00:00Z', ...extra,
});
test('GLB history groups original, delivery and preview by upload version and prefers the preview', () => {
  const history = productModelVersions([
    asset('source', 'deleted', 'v1', { original_name: 'original.glb', created_at: '2026-10-08T01:00:00Z' }),
    asset('preview'), asset('delivery'), asset('source', 'pending', 'v2'),
    asset('delivery', 'retired', 'v3'), asset('source', 'deleted', 'v4'), asset('standard', 'available', 'export'),
  ], 'v1');
  assert.equal(history.length, 4);
  const current = history.find(v => v.id === 'v1');
  assert.equal(current.status, 'current'); assert.equal(current.previewKind, 'preview');
  assert.equal(current.name, 'original.glb'); assert.equal(current.createdAt, '2026-10-08T01:00:00Z');
  assert.equal(history.find(v => v.id === 'v2').status, 'incomplete');
  assert.equal(history.find(v => v.id === 'v3').status, 'published');
  assert.equal(history.find(v => v.id === 'v4').assetId, null);
});

function setup({ scope = 'merchant', owned = true, assetValue = asset('preview'), denied = false, pages = [[]], stores = ['store'] } = {}) {
  const calls = [];
  const row = { id: modelId, product_id: 'p', store_ids: stores, glb_path: 'current.glb' };
  const db = { from(table) {
    const filters = [];
    const q = { select(value) { calls.push([table, 'select', value]); return q; },
      eq(key, value) { filters.push([key, value]); calls.push([table, key, value]); return q; },
      in(key, value) { calls.push([table, key, value]); return q; }, order() { return q; },
      async maybeSingle() {
        return { data: table === 'furniture_models' ? row : filters.some(f => f[0] === 'id') ? assetValue : { version_id: 'v1' }, error: null };
      }, async limit() { return { data: owned ? [{ id: 'store' }] : [], error: null }; },
      async range(start) { return { data: pages[start / 500] ?? [], error: null }; },
    }; return q;
  } };
  const auth = async () => denied ? { error: new Response(null, { status: 401 }) } : { userId: 'actor', error: null };
  const { productDetailsResponse } = loadSource('src/lib/productDetailsServer.ts', {
    '@/lib/supabase/admin': { getSupabaseAdmin: () => db },
    '@/lib/supabase/requireAdmin': { requireAdmin: auth },
    '@/lib/supabase/requireMerchant': { requireMerchant: auth },
    '@/lib/catalogServer': { productFromRow: () => ({ id: 'p', name: 'Product' }) },
    '@/lib/r2Models': { r2ModelKey: () => true, r2DownloadUrl: async () => 'https://test.local/asset' },
  });
  return { calls, get: query => productDetailsResponse(new NextRequest('http://local/details' + (query ?? '')), Promise.resolve({ id: 'p' }), scope) };
}
test('merchant details require a verified active store owner before reading assets', async () => {
  const foreign = setup({ owned: false });
  assert.equal((await foreign.get('?assetId=' + assetId)).status, 404);
  assert.ok(!foreign.calls.some(c => c[0] === 'model_assets'));
  const shared = setup({ stores: ['store', 'another-store'] });
  assert.equal((await shared.get()).status, 404);
  assert.ok(!shared.calls.some(c => c[0] === 'model_assets'));
  const owner = setup(); const response = await owner.get();
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.ok(owner.calls.some(c => c[1] === 'owner_id' && c[2] === 'actor'));
  assert.ok(owner.calls.some(c => c[1] === 'active' && c[2] === true));
  assert.ok(!JSON.stringify(await response.json()).includes('storage_path'));
});
test('admin history reads all pages and does not need merchant store ownership', async () => {
  const route = setup({ scope: 'admin', owned: false, pages: [Array.from({ length: 500 }, (_, i) => asset('delivery', 'retired', 'v' + i)), [asset('source', 'pending', 'last')]] });
  const response = await route.get();
  assert.equal((await response.json()).versions.length, 501);
  assert.ok(!route.calls.some(c => c[0] === 'merchant_stores'));
});
test('details reject unauthenticated users, deleted assets, pending outputs and private exports', async () => {
  const denied = setup({ denied: true }); assert.equal((await denied.get()).status, 401); assert.equal(denied.calls.length, 0);
  for (const value of [asset('source', 'deleted'), asset('delivery', 'pending'), asset('standard')]) {
    assert.equal((await setup({ assetValue: value }).get('?assetId=' + assetId)).status, 404);
  }
});
test('pending originals and retired previews stream privately and bind asset ID to the product model', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => new Response(new Uint8Array([1,2,3]));
    for (const value of [asset('source', 'pending'), asset('preview', 'retired')]) {
      const route = setup({ assetValue: { ...value, storage_path: 'r2://test/path.glb' } });
      const response = await route.get('?assetId=' + assetId);
      assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('vary'), 'Authorization');
      assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1,2,3]);
      assert.ok(route.calls.some(c => c[0] === 'model_assets' && c[1] === 'model_id' && c[2] === modelId));
      assert.ok(route.calls.some(c => c[0] === 'model_assets' && c[1] === 'id' && c[2] === assetId));
    }
  } finally { global.fetch = originalFetch; }
});
