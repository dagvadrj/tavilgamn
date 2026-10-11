const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { startKitchen } = loadSource('src/lib/kitchenStart.ts');
const { createUnifiedKitchen, parseKitchen } = loadSource('src/lib/kitchenAssembly.ts');
const { placementIssues } = loadSource('src/lib/kitchenPlacement.ts');
const defaults = { width: 4200, depth: 3200, height: 2700, layout: 'l-right', furnished: true, useCatalog: true, useSelected: false, door: true, window: true };

test('empty start preserves chosen dimensions and opening choices without modifying the previous draft', () => {
  const previous = createUnifiedKitchen(), before = JSON.stringify(previous);
  for (const door of [false, true]) for (const window of [false, true]) {
    const next = startKitchen(previous, { ...defaults, furnished: false, door, window });
    assert.equal(next.cabinets.length, 0);
    assert.equal(next.room.width, 4200);
    assert.equal(next.room.depth, 3200);
    assert.equal(next.room.items.some(i => i.kind === 'door'), door);
    assert.equal(next.room.items.some(i => i.kind === 'window'), window);
    assert.ok(parseKitchen(next, { allowEmpty: true }));
  }
  assert.equal(JSON.stringify(previous), before);
});

test('recommended layouts fit the exact requested room and survive persistence', () => {
  for (const layout of ['straight', 'l-right', 'u', 'double-side']) {
    const next = startKitchen(createUnifiedKitchen(), { ...defaults, layout, door: false, window: false });
    assert.ok(next.cabinets.length > 0);
    assert.equal(next.room.width, 4200);
    assert.equal(next.room.depth, 3200);
    assert.deepEqual(placementIssues(next).filter(i => i.severity === 'error'), []);
    assert.ok(parseKitchen(JSON.parse(JSON.stringify(next))));
  }
});

test('selected furniture takes priority when both sources are checked', () => {
  const previous = createUnifiedKitchen();
  previous.cabinets = previous.cabinets.filter(c => c.opening === 'sink');
  previous.cabinets[0].id = 'chosen-sink';
  previous.cabinets[0].frontMaterialId = 'chosen-material';
  const next = startKitchen(previous, { ...defaults, useSelected: true, door: false, window: false });
  assert.equal(next.cabinets.filter(c => c.opening === 'sink').length, 1);
  assert.equal(next.cabinets.find(c => c.opening === 'sink').id, 'chosen-sink');
  assert.equal(next.cabinets.find(c => c.opening === 'sink').frontMaterialId, 'chosen-material');
  assert.ok(next.cabinets.length > previous.cabinets.length);
  assert.equal(new Set(next.cabinets.map(c => c.id)).size, next.cabinets.length);
  assert.ok(parseKitchen(next));
});

test('invalid dimensions, missing furniture sources and impossible rooms are rejected', () => {
  for (const patch of [{ width: NaN }, { height: 100 }, { depth: 30000 }, { useCatalog: false, useSelected: false }, { width: 1000, depth: 1000 }]) {
    assert.throws(() => startKitchen(createUnifiedKitchen(), { ...defaults, ...patch }));
  }
});
