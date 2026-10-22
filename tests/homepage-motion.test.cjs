const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { DEFAULT_HOMEPAGE_HERO, parseHomepageHero, homepageStatistics } = loadSource('src/lib/homepagePresentation.ts');

test('hero validates destinations and images rather than allowing script, external redirects or oversized text', () => {
  assert.deepEqual(parseHomepageHero(DEFAULT_HOMEPAGE_HERO), DEFAULT_HOMEPAGE_HERO);
  for (const href of ['javascript:alert(1)', '//evil.test', '/\\evil.test', '/admin', '/missing-page', 'https://evil.test']) {
    assert.equal(parseHomepageHero({ ...DEFAULT_HOMEPAGE_HERO, primaryHref: href }), null);
  }
  for (const image of ['data:image/svg+xml,<svg>', 'javascript:alert(1)', '//evil.test/x.png', 'https://name:password@host.test/image.png']) assert.equal(parseHomepageHero({ ...DEFAULT_HOMEPAGE_HERO, image }), null);
  assert.equal(parseHomepageHero({ ...DEFAULT_HOMEPAGE_HERO, title: 'a'.repeat(121) }), null);
  assert.ok(parseHomepageHero({ ...DEFAULT_HOMEPAGE_HERO, primaryHref: '/catalog?room=living', image: '/rooms/living-room.webp' }));
});

test('public counts deduplicate the complete listing, weight actual reviews and distinguish material failure from zero', () => {
  const products = [
    { id: 'a', category: 'sofa', rating: 5, reviewCount: 1, model: { id: 'model' } },
    { id: 'b', category: 'bed', rating: 3, reviewCount: 3 },
    { id: 'c', category: 'sofa', rating: 99, reviewCount: 100 },
  ];
  const result = homepageStatistics([...products, products[0]], [{ id: 'shop' }, { id: 'shop' }], null);
  assert.equal(result.products, 3);
  assert.equal(result.models, 1);
  assert.equal(result.stores, 1);
  assert.equal(result.rating, 3.5);
  assert.equal(result.reviews, 4);
  assert.equal(result.materials, null);
  assert.deepEqual(result.categories, [{ id: 'sofa', count: 2 }, { id: 'bed', count: 1 }]);
  assert.deepEqual(homepageStatistics([], [], 0), { products: 0, models: 0, stores: 0, materials: 0, rating: null, reviews: 0, categories: [] });
  assert.ok(!('revenue' in result));
});

test('hero saves preserve legacy scene assets and reject optimistic concurrency conflicts', async () => {
  const { defaultHomepageSettings } = loadSource('src/lib/homepageSettings.ts');
  const current = { ...defaultHomepageSettings(), version: 3 };
  let row, authorized = false, filters = [];
  const { PUT } = loadSource('src/app/api/admin/homepage/route.ts', {
    '@/lib/supabase/requireAdmin': { requireAdmin: async () => authorized ? { userId: 'admin' } : { error: new Response('', { status: 401 }) } },
    '@/lib/homepageSettingsServer': { readHomepageSettings: async () => current },
    '@/lib/catalogServer': { readProduct: async () => { throw new Error('Retired GLB must not block hero editing'); } },
    '@/lib/supabase/admin': { getSupabaseAdmin: () => ({ from: () => ({ update(value) { row = value; return this; }, eq(key, value) { filters.push([key, value]); return this; }, select() { return this; }, maybeSingle: async () => ({ data: { version: 4 } }) }) }) },
  });
  const request = version => new Request('http://localhost/api/admin/homepage', { method: 'PUT', body: JSON.stringify({ ...current, version, hero: DEFAULT_HOMEPAGE_HERO }) });
  assert.equal((await PUT(request(3))).status, 401);
  authorized = true;
  assert.equal((await PUT(request(2))).status, 409);
  assert.equal((await PUT(request(3))).status, 200);
  assert.deepEqual(row.product_ids, current.productIds);
  assert.deepEqual(row.hero, DEFAULT_HOMEPAGE_HERO);
  assert.ok(filters.some(([key, value]) => key === 'version' && value === 3));
});

test('marketing preview only exposes ready models in active kitchen modules and rejects unknown kinds', async () => {
  const cabinet = { active: true, name: 'Base', widthMm: 600, heightMm: 840, depthMm: 600, variants: [{ active: true, processingStatus: 'ready', glbFile: 'base.glb', furnitureModelId: 'model', thumbnailUrl: '/thumb.webp' }] };
  const { GET } = loadSource('src/app/api/marketing-model/route.ts', {
    '@/lib/publicCatalog': { readCachedProducts: async () => [] },
    '@/lib/kitchenModuleCatalogServer': { readKitchenModuleCatalog: async () => [{ ...cabinet, active: false }, cabinet] },
  });
  assert.equal((await GET(new Request('http://localhost/api/marketing-model?kind=bad'))).status, 400);
  assert.equal((await GET(new Request('http://localhost/api/marketing-model?kind=room'))).status, 404);
  const response = await GET(new Request('http://localhost/api/marketing-model?kind=kitchen'));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).model.dimensions, { w: 0.6, d: 0.6, h: 0.84 });
});
