const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { kitchenForGeneratedParts } = loadSource('src/lib/kitchenGeneratedParts.ts');
const { createCabinet, createModularKitchen } = loadSource('src/lib/kitchenCabinets.ts');
const { fitCountertops, fitPlinths } = loadSource('src/lib/kitchenPlacement.ts');
const { fitBacksplashes } = loadSource('src/lib/kitchenBacksplash.ts');
const models = { oven: { glbFile: 'oven.glb' } };
function cabinet(id, x, model) {
  const item = createCabinet('base', id);
  return { ...item, variantId: model, position: { ...item.position, x, z: 300 } };
}

test('a complete oven GLB gets no generated countertop, backsplash, plinth or second hob', () => {
  const oven = { ...cabinet('one', 300, 'oven'), opening: 'hob' };
  const kitchen = { ...createModularKitchen(), cabinets: [oven], backsplash: true };
  const generated = kitchenForGeneratedParts(kitchen, models);
  assert.deepEqual(generated.cabinets, []);
  assert.deepEqual(fitCountertops(generated), []);
  assert.deepEqual(fitPlinths(generated), []);
  assert.deepEqual(fitBacksplashes(generated), []);
  assert.equal(kitchen.cabinets[0], oven, 'the model and saved design stay intact');
});

test('a mixed row splits generated fittings around GLBs and preserves procedural cabinets', () => {
  const kitchen = { ...createModularKitchen(), cabinets: [cabinet('left', 300), cabinet('glb', 900, 'oven'), cabinet('right', 1500)], backsplash: true };
  const generated = kitchenForGeneratedParts(kitchen, models);
  assert.deepEqual(generated.cabinets.map(item => item.id), ['left', 'right']);
  for (const fit of [fitCountertops, fitPlinths]) {
    const runs = fit(generated);
    assert.equal(runs.length, 2, 'no generated board bridges over the GLB');
    assert.ok(runs.every(run => !run.cabinetIds.includes('glb') && run.width === 600));
  }
  assert.equal(fitBacksplashes(generated).length, 2);
});

test('an unavailable model still gets all necessary procedural fallback fittings', () => {
  const kitchen = { ...createModularKitchen(), cabinets: [cabinet('fallback', 300, 'missing')], backsplash: true };
  assert.equal(kitchenForGeneratedParts(kitchen, models), kitchen);
  assert.equal(kitchenForGeneratedParts(kitchen), kitchen);
  assert.equal(kitchenForGeneratedParts(kitchen, { missing: { glbFile: null } }), kitchen);
  assert.equal(fitCountertops(kitchen).length, 1);
  assert.equal(fitPlinths(kitchen).length, 1);
});

test('explicit manually positioned wall panels remain independent of automatic GLB coverings', () => {
  const panel = { id: 'manual', width: 600, height: 400, thickness: 12, position: { x: 300, y: 880, z: 6, rotation: 0 } };
  const kitchen = { ...createModularKitchen(), cabinets: [cabinet('glb', 300, 'oven')], backsplash: true,
    backsplashSettings: { mode: 'manual', panels: [panel] } };
  assert.deepEqual(fitBacksplashes(kitchenForGeneratedParts(kitchen, models)), [panel]);
});
