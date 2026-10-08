const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadSource } = require('./helpers/load-source.cjs');
const { cabinetFromCatalog } = loadSource('src/lib/kitchenCatalogInsertion.ts');
const { createModularKitchen, validateCabinet } = loadSource('src/lib/kitchenCabinets.ts');
const { findCabinetSpace, placementIssues } = loadSource('src/lib/kitchenPlacement.ts');
const { applyKitchenCatalogVariants } = loadSource('src/lib/kitchenModuleCatalog.ts');
function fixture(type = 'base', height = 740) {
  const variant = { furnitureModelId: 'glb-800', modelName: '800 mm cabinet', productId: 'p800', active: true,
    glbFile: 'cabinet.glb', glbUrl: '/api/models/files/glb-800/cabinet.glb', thumbnailUrl: null,
    opening: 'doors', doorCount: 2, drawerCount: 0, isDefault: true, sortOrder: 0, configuration: {} };
  return { id: 'module800', name: 'Cabinet', code: 'BASE800', cabinetType: type, active: true,
    widthMm: 800, heightMm: height, depthMm: type === 'wall' ? 350 : 598, variants: [variant] };
}

test('a nonstandard-height GLB is placed at authored dimensions and retains its variant after commit and reload', () => {
  const module = fixture();
  const cabinet = cabinetFromCatalog(module, module.variants[0], 'one', 2600);
  assert.equal(validateCabinet(cabinet), null);
  assert.deepEqual([cabinet.width, cabinet.height, cabinet.depth], [800, 740, 598]);
  const placed = findCabinetSpace({ ...createModularKitchen(), cabinets: [] }, cabinet);
  assert.ok(placed);
  const committed = applyKitchenCatalogVariants(placed, [module]);
  const reloaded = applyKitchenCatalogVariants(JSON.parse(JSON.stringify(committed)), [module]);
  assert.equal(reloaded.cabinets[0].variantId, 'glb-800');
  assert.equal(reloaded.cabinets[0].height, 740);
  assert.ok(!placementIssues(reloaded).some(issue => issue.severity === 'error'));
  const second = cabinetFromCatalog(module, module.variants[0], 'two', 2600);
  const two = findCabinetSpace(reloaded, second);
  assert.ok(two);
  assert.ok(!placementIssues(two).some(issue => issue.severity === 'error'));
});

test('authored tall and wall GLBs keep physical height instead of stretching to the ceiling', () => {
  for (const type of ['wall', 'tall']) {
    const module = fixture(type, type === 'tall' ? 2100 : 740);
    const cabinet = cabinetFromCatalog(module, module.variants[0], type, 3000);
    assert.equal(cabinet.fitToCeiling, false);
    assert.equal(cabinet.autoElevation, type === 'wall');
    assert.equal(cabinet.height, module.heightMm);
    assert.equal(applyKitchenCatalogVariants({ cabinets: [cabinet] }, [module]).cabinets[0].variantId, 'glb-800');
  }
});

test('inactive, missing-file, unlinked and unsupported model entries cannot be inserted', () => {
  const module = fixture();
  const v = module.variants[0];
  assert.equal(cabinetFromCatalog({ ...module, active: false }, v, 'id', 2600), null);
  assert.equal(cabinetFromCatalog(module, { ...v, active: false }, 'id', 2600), null);
  assert.equal(cabinetFromCatalog(module, { ...v, glbFile: null }, 'id', 2600), null);
  assert.equal(cabinetFromCatalog(module, { ...v, furnitureModelId: 'foreign' }, 'id', 2600), null);
  assert.equal(cabinetFromCatalog({ ...module, cabinetType: 'appliance' }, v, 'id', 2600), null);
});

test('the add library exposes real GLBs and omits inactive and specification-only entries', () => {
  const { KitchenModelLibrary } = loadSource('src/features/kitchen-planner/components/KitchenModelLibrary.tsx', {
    '@/lib/modelPrefetch': { prefetchModel: () => {} },
  });
  const module = fixture();
  const html = renderToStaticMarkup(React.createElement(KitchenModelLibrary, {
    modules: [module, { ...module, id: 'empty', variants: [] }, { ...module, id: 'inactive', active: false }],
    loading: false, error: false, retry() {}, disabled: false, onAdd() {},
  }));
  assert.equal((html.match(/class="planner-model-card"/g) || []).length, 1);
  assert.match(html, /800 mm cabinet — гарнитурт нэмэх/);
  assert.doesNotMatch(html, /cabinet\.glb/);
  assert.match(html, /800 × 598 × 740 мм/);
});

test('a failed library request is explained with an available retry action', () => {
  const { KitchenModelLibrary } = loadSource('src/features/kitchen-planner/components/KitchenModelLibrary.tsx', {
    '@/lib/modelPrefetch': { prefetchModel: () => {} },
  });
  const html = renderToStaticMarkup(React.createElement(KitchenModelLibrary, {
    modules: [], loading: false, error: true, retry() {}, disabled: false, onAdd() {},
  }));
  assert.match(html, /role="alert"/);
  assert.match(html, /Дахин оролдох/);
});
