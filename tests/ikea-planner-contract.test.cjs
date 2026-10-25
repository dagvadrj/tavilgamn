const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { createCabinet, createModularKitchen } = loadSource('src/lib/kitchenCabinets.ts');
const { preferredKitchenVariant, matchingKitchenVariants, kitchenVariantFits } = loadSource('src/lib/kitchenModuleCatalog.ts');
const { placementIssues } = loadSource('src/lib/kitchenPlacement.ts');

function moduleOf(id, width = 600, price = 100) {
  return { id, code: id, name: id, cabinetType: 'base', widthMm: width, heightMm: 840, depthMm: 600, active: true,
    variants: [{ furnitureModelId: id, productId: id, modelName: id, variantCode: id, opening: 'doors', doorCount: 2, drawerCount: 0,
      active: true, processingStatus: 'ready', glbFile: `${id}.glb`, configuration: {}, isDefault: true, sortOrder: price }] };
}
const productOf = (id, price, width = 600) => ({ id, name: id, category: 'kitchen-cabinet', basePrice: price, dimensions: { w: width / 1000, h: .84, d: .6 },
  model: { id, file: `${id}.glb` }, colors: [], materials: [], defaultColor: 'wood', inStock: true, stockQuantity: 10 });

test('saved model IDs never override measured size, mount or failed asset validation', () => {
  const m = moduleOf('wrong-width', 800), c = { ...createCabinet('base', 'c'), variantId: 'wrong-width' };
  assert.equal(preferredKitchenVariant([m], c), undefined);
  assert.deepEqual(matchingKitchenVariants([m], c), []);
  const exact = moduleOf('exact');
  exact.variants[0].mount = 'wall';
  assert.equal(preferredKitchenVariant([exact], c), undefined);
  exact.variants[0].mount = 'floor';
  exact.variants[0].assetValidationIssues = ['height mismatch'];
  assert.equal(preferredKitchenVariant([exact], c), undefined);
  assert.equal(kitchenVariantFits(exact.variants[0], c), false);
});

test('editor and insertion share window aperture heights; a base fits below a sill, tall furniture does not', () => {
  const base = createCabinet('base', 'base');
  const room = { width: 3000, depth: 3000, height: 2600, items: [{ id: 'w', kind: 'window', wall: 'back', x: 300, z: 0, width: 600, depth: 100 }] };
  const k = { ...createModularKitchen(), room, cabinets: [base] };
  assert.ok(!placementIssues(k).some(i => i.code === 'opening'));
  const tall = createCabinet('tall', 'tall');
  assert.ok(placementIssues({ ...k, cabinets: [tall] }).some(i => i.code === 'opening' && i.ids.includes('w')));
  assert.ok(placementIssues({ ...k, room: { ...room, items: [{ ...room.items[0], sillHeight: 600, height: 1000 }] } }).some(i => i.code === 'opening'));
  assert.ok(placementIssues({ ...k, cabinets: [{ ...base, position: { ...base.position, y: 100 } }] }).some(i => i.code === 'floor'));
});

test('door reservation follows inward/outward swing and custom opening dimensions survive parsing', () => {
  const { parseKitchenSpace } = loadSource('src/lib/kitchenSpace.ts');
  const base = { ...createCabinet('base', 'base'), position: { x: 500, z: 700, y: 0, rotation: 0 } };
  const item = { id: 'd', kind: 'door', wall: 'back', x: 500, z: 0, width: 900, depth: 100, height: 2000, sillHeight: 0, swing: 'inward' };
  const k = { ...createModularKitchen(), cabinets: [base], room: { width: 3000, depth: 3000, height: 2600, items: [item] } };
  assert.ok(placementIssues(k).some(i => i.ids.includes('d')));
  assert.ok(!placementIssues({ ...k, room: { ...k.room, items: [{ ...item, swing: 'outward' }] } }).some(i => i.ids.includes('d')));
  assert.deepEqual(parseKitchenSpace(k.room).items[0], item);
  assert.throws(() => parseKitchenSpace({ ...k.room, items: [{ ...item, height: 2800 }] }));
});

test('catalog suggestions preserve the source, use actual product sizes and enforce known budgets', () => {
  const { kitchenDesignSuggestionResult, suggestionGeometrySignature } = loadSource('src/lib/kitchenDesignSuggestions.ts');
  const modules = [moduleOf('original', 600), moduleOf('cheap', 400), moduleOf('storage', 800)];
  const products = [productOf('original', 300), productOf('cheap', 100, 400), productOf('storage', 500, 800)];
  const c = { ...createCabinet('base', 'c'), variantId: 'original' };
  const k = { ...createModularKitchen(), cabinets: [c], room: { width: 4000, depth: 3000, height: 2600 } };
  const before = structuredClone(k);
  const result = kitchenDesignSuggestionResult(k, { modules, products, useCatalog: true, goal: 'budget', budget: 150 });
  assert.ok(result.suggestions.length > 0);
  assert.ok(result.suggestions.every(s => s.metrics.price <= 150 && s.design.cabinets[0].width === 400 && s.design.cabinets[0].variantId === 'cheap'));
  assert.equal(new Set(result.suggestions.map(s => suggestionGeometrySignature(s.design))).size, result.suggestions.length);
  assert.deepEqual(k, before);
  assert.ok(result.rejected.budget > 0);
  const unknown = kitchenDesignSuggestionResult(k, { budget: 150 });
  assert.equal(unknown.suggestions.length, 0);
  assert.ok(unknown.rejected.unpriced > 0);
});

test('catalog responses retain failed physical validation so incompatible delivery cannot enter the scene', async () => {
  const rows = {
    kitchen_modules: [{ id: 'm', cabinet_type: 'base', width_mm: 600, height_mm: 840, depth_mm: 600, active: true }],
    kitchen_module_variants: [{ furniture_model_id: 'model', module_id: 'm', opening: 'doors', active: true, configuration: {} }],
    kitchen_models: [{ id: 'model', product_id: 'product', category: 'kitchen-cabinet', processing_status: 'ready', glb_path: 'delivery.glb',
      glb_validation: { dimensions: { widthMm: 600, heightMm: 740, depthMm: 600 }, bottomCentered: true, transformsApplied: true } }],
  };
  const db = { from(table) { return { select() { return this; }, eq() { return this; }, order() { return this; }, in() { return this; },
    then(resolve, reject) { return Promise.resolve({ data: rows[table], error: null }).then(resolve, reject); } }; } };
  const { readKitchenModuleCatalog } = loadSource('src/lib/kitchenModuleCatalogServer.ts', { '@/lib/supabase/admin': { getSupabaseAdmin: () => db } });
  const modules = await readKitchenModuleCatalog({}, db);
  assert.ok(modules[0].variants[0].assetValidationIssues.some(i => i.includes('heightMm')));
  assert.equal(preferredKitchenVariant(modules, createCabinet('base', 'c')), undefined);
});

test('BOM uses selected part identities, removes dependent parts and leaves unconfirmed bundle prices unknown', () => {
  const { buildKitchenBom, kitchenBomCsv } = loadSource('src/lib/kitchenBom.ts');
  const doorId = '22222222-2222-4222-8222-222222222222';
  const handleId = '33333333-3333-4333-8333-333333333333';
  const m = moduleOf('frame');
  const slot = (id, modelId, extra = {}) => ({ id, kind: id === 'door' ? 'door' : 'handle', label: id, optional: true,
    defaultOptionId: 'default', options: [{ id: 'default', label: id, modelId, productId: `${id}-sku` }], ...extra });
  m.variants[0].configuration = { assembly: { version: 1, slots: [slot('door', doorId), slot('handle', handleId, { parentSlotId: 'door' })] } };
  const c = { ...createCabinet('base', 'c'), variantId: 'frame' };
  const k = { ...createModularKitchen(), cabinets: [c] };
  const bom = buildKitchenBom(k, [m], [productOf('frame', 100)]);
  const parts = bom.items.filter(i => i.id.includes('/slot/'));
  assert.equal(parts.length, 2); assert.equal(parts[0].productId, 'door-sku'); assert.equal(parts[0].modelId, doorId);
  assert.ok(parts.every(i => i.unitPrice === null && !i.included));
  assert.ok(kitchenBomCsv(bom).includes('door-sku'));
  const removed = buildKitchenBom({ ...k, cabinets: [{ ...c, partSelections: { door: '' } }] }, [m], []);
  assert.ok(!removed.items.some(i => i.id.includes('/slot/')));
});

test('a blind corner must contact both perpendicular room walls', () => {
  const c = { ...createCabinet('base', 'corner', 1000), corner: true, cornerSide: 'left', position: { x: 500, z: 300, y: 0, rotation: 0 } };
  const k = { ...createModularKitchen(), cabinets: [c] };
  assert.ok(!placementIssues(k).some(i => i.code === 'corner'));
  assert.ok(placementIssues({ ...k, cabinets: [{ ...c, position: { ...c.position, x: 1500 } }] }).some(i => i.code === 'corner'));
});
