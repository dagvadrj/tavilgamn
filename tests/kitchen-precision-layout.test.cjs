const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { createCabinet, createModularKitchen, createHood, createRefrigerator, roomWalls } = loadSource('src/lib/kitchenCabinets.ts');
const { createUnifiedKitchen, arrangeKitchen, replaceCorner, parseKitchen } = loadSource('src/lib/kitchenAssembly.ts');
const { cabinetAxes, cabinetCorners, cabinetsOverlap, footprintsOverlap, snapCabinet, fitCountertops, fitPlinths, findCabinetSpace, placementIssues } = loadSource('src/lib/kitchenPlacement.ts');
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);
const kitchen = cabinets => ({ ...createModularKitchen(), cabinets });
const rectangle = board => ({ ...createCabinet('base', board.id), ...board, height: board.height ?? board.thickness ?? 1 });

test('cardinal coordinate axes are exact and even 0.005 mm penetration is rejected', () => {
  assert.deepEqual(cabinetAxes(-Math.PI / 2), { right: { x: 0, z: 1 }, front: { x: -1, z: 0 } });
  const a = createCabinet('base', 'a'), b = createCabinet('base', 'b');
  b.position.x = 900;
  assert.equal(cabinetsOverlap(a, b), false);
  b.position.x -= 0.005;
  assert.equal(cabinetsOverlap(a, b), true);
});

test('magnet closes perpendicular return gaps while preserving room wall contact', () => {
  const room = createModularKitchen().room;
  for (const side of ['left', 'right']) {
    const corner = replaceCorner(createCabinet('base', 'corner'), true, side);
    corner.position = { x: side === 'left' ? 500 : room.width - 500, z: 300, y: 0, rotation: 0 };
    const returning = createCabinet('base', 'return');
    returning.position = { x: side === 'left' ? 300 : room.width - 300, z: 960, y: 0, rotation: side === 'left' ? Math.PI / 2 : -Math.PI / 2 };
    const result = snapCabinet(returning, returning.position, [corner], roomWalls(room));
    assert.equal(result.neighbourId, corner.id);
    assert.equal(result.wallId, side);
    near(result.position.z, 900);
    near(result.position.x, returning.position.x);
    assert.equal(cabinetsOverlap(corner, { ...returning, position: result.position }), false);
  }
});

test('L defaults include accessible blind corners and can remain ordinary after replacement', () => {
  for (const layout of ['l-left', 'l-right']) {
    const k = arrangeKitchen(createUnifiedKitchen(), layout);
    assert.deepEqual(placementIssues(k).filter(i => i.severity === 'error'), []);
    const corners = k.cabinets.filter(c => c.corner);
    assert.equal(corners.length, 2);
    assert.equal(corners.find(c => c.type === 'base').width, 1000);
    assert.equal(corners.find(c => c.type === 'wall').width, 800);
    assert.ok(corners.every(c => c.width - c.depth >= 400));
    assert.equal(k.cabinets.find(c => c.id === 'base-4').opening, 'oven');
    const plain = { ...k, cabinets: k.cabinets.map(c => c.corner ? replaceCorner(c, false) : c) };
    const rearranged = arrangeKitchen(plain, layout);
    assert.equal(rearranged.cabinets.filter(c => c.corner).length, 0);
    assert.deepEqual(placementIssues(rearranged).filter(i => i.severity === 'error'), []);
    assert.deepEqual(parseKitchen(JSON.parse(JSON.stringify(k))), k);
  }
});

test('L countertops cover both runs with exact butt joints and no overlap', () => {
  for (const layout of ['l-left', 'l-right']) {
    const k = arrangeKitchen(createUnifiedKitchen(), layout), tops = fitCountertops(k);
    assert.equal(tops.length, 2);
    const main = tops.find(t => t.position.rotation === 0), returning = tops.find(t => t.position.rotation !== 0);
    near(main.width, 2200); near(returning.width, 1180);
    near(Math.min(...cabinetCorners(rectangle(returning)).map(p => p.z)), 620);
    for (let i = 0; i < tops.length; i++) for (const other of tops.slice(i + 1)) assert.equal(footprintsOverlap(rectangle(tops[i]), rectangle(other)), false);
    near(tops.reduce((sum, top) => sum + top.width * top.depth, 0), (2200 + 1200) * 620 - 20 * 620);
    const reversed = fitCountertops({ ...k, cabinets: [...k.cabinets].reverse() });
    assert.deepEqual(reversed.map(t => [t.width, t.depth, t.position]), tops.map(t => [t.width, t.depth, t.position]));
  }
});

test('plinths merge straight fronts and meet at recessed L corners without overlap', () => {
  assert.equal(fitPlinths(createUnifiedKitchen()).length, 1);
  near(fitPlinths(createUnifiedKitchen())[0].width, 3000);
  for (const layout of ['l-left', 'l-right']) {
    const runs = fitPlinths(arrangeKitchen(createUnifiedKitchen(), layout));
    assert.equal(runs.length, 2);
    assert.ok(runs.every(r => r.depth === 18 && r.height === 80));
    assert.equal(footprintsOverlap(rectangle(runs[0]), rectangle(runs[1])), false);
    const cornersA = cabinetCorners(rectangle(runs[0])), cornersB = cabinetCorners(rectangle(runs[1]));
    assert.ok(cornersA.some(a => cornersB.some(b => Math.hypot(a.x - b.x, a.z - b.z) < 0.000001)), 'the two fascia boards must share a joint corner');
  }
});

test('opposite parallel runs face inward and preserve dimensions and appliance openings', () => {
  const original = createUnifiedKitchen(), k = arrangeKitchen(original, 'double-side');
  assert.deepEqual(placementIssues(k).filter(i => i.severity === 'error'), []);
  assert.equal(k.layout, 'double-side');
  assert.ok(k.cabinets.some(c => c.position.rotation === Math.PI));
  assert.deepEqual(k.cabinets.map(c => [c.id, c.width, c.height, c.depth, c.opening]), original.cabinets.map(c => [c.id, c.width, c.height, c.depth, c.opening]));
  assert.deepEqual(parseKitchen(JSON.parse(JSON.stringify(k))), k);
});

test('new cabinet positions use true free edges after a 750 mm wide appliance', () => {
  const fridge = { ...createCabinet('tall', 'fridge'), opening: 'refrigerator', width: 750, height: 1900, depth: 600, fitToCeiling: false, doorCount: 2, refrigeratorStyle: 'top-bottom' };
  fridge.position = { x: 375, y: 0, z: 300, rotation: 0 };
  const result = findCabinetSpace(kitchen([fridge]), createCabinet('base', 'added'));
  assert.ok(result);
  near(result.cabinets.find(c => c.id === 'added').position.x, 1050);
});

test('hoods remain centered over cookers when changing between all four layouts', () => {
  const original = createUnifiedKitchen(), cooker = original.cabinets.find(c => c.opening === 'oven'), hood = createHood('hood', 'wall');
  hood.position.x = cooker.position.x;
  original.cabinets.push(hood);
  for (const layout of ['straight', 'l-left', 'l-right', 'double-side']) {
    const k = arrangeKitchen(original, layout), nextCooker = k.cabinets.find(c => c.id === cooker.id), nextHood = k.cabinets.find(c => c.id === hood.id);
    assert.deepEqual(placementIssues(k).filter(i => i.severity === 'error'), [], layout);
    const { right } = cabinetAxes(nextCooker.position.rotation);
    near((nextCooker.position.x - nextHood.position.x) * right.x + (nextCooker.position.z - nextHood.position.z) * right.z, 0);
    near(nextCooker.position.rotation, nextHood.position.rotation);
  }
});

test('layout keeps tall refrigerator volume clear of upper cabinets', () => {
  const original = createUnifiedKitchen(), fridge = createRefrigerator('fridge', 'top-bottom');
  fridge.position.x = 3600;
  original.cabinets.push(fridge);
  for (const layout of ['straight', 'l-left', 'l-right', 'double-side']) {
    const k = arrangeKitchen(original, layout);
    assert.deepEqual(placementIssues(k).filter(i => i.severity === 'error'), [], layout);
    assert.equal(k.cabinets.find(c => c.id === fridge.id).height, 1850);
  }
});
