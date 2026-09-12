const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { loadSource } = require('./helpers/load-source.cjs');
const model = loadSource('src/lib/kitchenCabinets.ts');
const placement = loadSource('src/lib/kitchenPlacement.ts');
const { createCabinet, createModularKitchen, roomWalls, validateCabinet } = model;
const { cabinetCorners, footprintsOverlap, cabinetsOverlap, snapCabinet, fitCountertops, placementIssues, resolveElevations, proposeCabinetMove, findCabinetSpace, wallCabinetClearance } = placement;
const near = (a, b) => assert.ok(Math.abs(a - b) < .001, `${a} != ${b}`);
function cabinet(id, x, z = 300, type = 'base', width = 600) {
  const c = createCabinet(type, id, width);
  return { ...c, position: { ...c.position, x, z: type === 'wall' ? 175 : z } };
}
function kitchen(cabinets) { return { ...createModularKitchen(), cabinets }; }

test('cabinet defaults and exported JSON schema agree for every width/type', () => {
  const Ajv = require('ajv');
  const validate = new Ajv({ allErrors: true }).compile(JSON.parse(readFileSync('src/lib/cabinet.schema.json', 'utf8')));
  for (const type of ['base', 'wall', 'tall']) for (const width of [300, 400, 600, 800]) {
    const c = createCabinet(type, `${type}-${width}`, width);
    assert.equal(validate(c), true, JSON.stringify(validate.errors)); assert.equal(validateCabinet(c), null);
  }
  for (const patch of [{ width: 500 }, { height: 790 }, { doorCount: 3 }, { drawerCount: 5 }, { color: 'red' }, { material: 'invalid' }]) {
    const c = { ...createCabinet('base', 'bad'), ...patch };
    assert.equal(validate(c), false); assert.ok(validateCabinet(c));
  }
  assert.equal(validate({ ...createCabinet('wall', 'w'), drawerCount: 1 }), false);
  assert.equal(validate({ ...createCabinet('base', 'b', 300), doorCount: 2 }), false);
});
test('initial layout is valid and counter width sums all four base cabinets', () => {
  const k = createModularKitchen();
  assert.deepEqual(placementIssues(k), []);
  const tops = fitCountertops(k);
  assert.equal(tops.length, 1); assert.equal(tops[0].width, 2400); assert.equal(tops[0].depth, 620);
  assert.equal(tops[0].position.y, 820); assert.equal(tops[0].thickness, 30);
  assert.equal(wallCabinetClearance(k.cabinets[4], k), 550);
});
test('snaps to all four wall surfaces with front facing inward', () => {
  const k = kitchen([]), c = cabinet('a', 1300);
  const examples = [
    [{ x: 1300, z: 350 }, { x: 1300, z: 300, rotation: 0 }],
    [{ x: 3650, z: 1300 }, { x: 3700, z: 1300, rotation: -Math.PI / 2 }],
    [{ x: 1300, z: 2650 }, { x: 1300, z: 2700, rotation: Math.PI }],
    [{ x: 350, z: 1300 }, { x: 300, z: 1300, rotation: Math.PI / 2 }],
  ];
  for (const [requested, expected] of examples) {
    const result = snapCabinet(c, { ...c.position, ...requested }, [], roomWalls(k.room));
    assert.ok(result.wallId); near(result.position.x, expected.x); near(result.position.z, expected.z); near(result.position.rotation, expected.rotation);
  }
});
test('wall normals work for angled finite segments and reject tiny walls', () => {
  const c = cabinet('c', 0), q = Math.SQRT1_2;
  const wall = { id: 'diagonal', start: { x: 0, z: 0 }, end: { x: 2000, z: 2000 }, inward: { x: -q, z: q } };
  const result = snapCabinet(c, { ...c.position, x: 900 - q * 340, z: 900 + q * 340 }, [], [wall]);
  assert.equal(result.wallId, 'diagonal'); near(result.position.rotation, -Math.PI / 4);
  near((result.position.z - result.position.x) * q, 300);
  assert.equal(snapCabinet(c, c.position, [], [{ ...wall, end: { x: 100, z: 0 } }]).wallId, undefined);
  assert.equal(snapCabinet(c, c.position, [], [{ ...wall, end: wall.start }]).wallId, undefined);
});
test('wall snaps respect endpoints and do not attract distant free cabinets', () => {
  const c = cabinet('c', 250);
  const result = snapCabinet(c, c.position, [], roomWalls(kitchen([]).room));
  near(result.position.x, 300);
  const distant = { ...c.position, x: 1500, z: 1000 };
  assert.deepEqual(snapCabinet(c, distant, [], roomWalls(kitchen([]).room)).position, distant);
});
test('adjacent snapping closes either side gap and aligns unequal depths at backs', () => {
  const other = cabinet('b', 1200), c = { ...cabinet('a', 0, 350, 'base', 400), depth: 650 };
  for (const sign of [-1, 1]) {
    const result = snapCabinet(c, { ...c.position, x: 1200 + sign * 550 }, [other], roomWalls(kitchen([]).room));
    assert.equal(result.neighbourId, 'b'); near(result.position.x, 1200 + sign * 500); near(result.position.z, 325);
    assert.equal(cabinetsOverlap({ ...c, position: result.position }, other), false);
  }
});
test('adjacency works on rotated wall and rejects occupied destination', () => {
  const b = cabinet('b', 3700, 1000); b.position.rotation = -Math.PI / 2;
  const a = cabinet('a', 3700, 1650); a.position.rotation = -Math.PI / 2;
  const snapped = snapCabinet(a, a.position, [b], roomWalls(kitchen([]).room));
  near(snapped.position.z, 1600); assert.equal(snapped.neighbourId, 'b');
  const occupied = { ...a, id: 'occupied', position: { ...a.position, z: 1600 } };
  const blocked = snapCabinet(a, a.position, [b, occupied], roomWalls(kitchen([]).room));
  assert.equal(blocked.neighbourId, undefined);
});
test('collision allows face contact and stacking but catches rotated intersection', () => {
  const a = cabinet('a', 500), b = cabinet('b', 1100);
  assert.equal(cabinetsOverlap(a, b), false);
  assert.equal(cabinetsOverlap(a, { ...b, position: { ...b.position, x: 1099 } }), true);
  const upper = cabinet('w', 500, 175, 'wall');
  assert.equal(footprintsOverlap(a, upper), true); assert.equal(cabinetsOverlap(a, upper), false);
  const rotated = { ...b, position: { ...b.position, x: 800, rotation: Math.PI / 4 } };
  assert.equal(cabinetsOverlap(a, rotated), true);
  assert.equal(cabinetsOverlap(rotated, a), true);
});
test('SAT does not confuse rotated AABB overlap with actual footprint overlap', () => {
  const a = { ...cabinet('a', 1500, 1500), width: 800, depth: 250 };
  a.position.rotation = Math.PI / 4;
  const b = { ...a, id: 'b', position: { ...a.position, x: 1500 + 300 * Math.SQRT1_2, z: 1500 + 300 * Math.SQRT1_2 } };
  assert.equal(footprintsOverlap(a, b), false);
});
test('ceiling, room boundary, unsupported wall cabinets and clearance have explicit issues', () => {
  const wall = cabinet('w', 1500, 175, 'wall'); wall.position.z = 1000;
  assert.ok(placementIssues(kitchen([wall])).some(i => i.code === 'wall'));
  const base = cabinet('b', 100); assert.ok(placementIssues(kitchen([base])).some(i => i.code === 'outside'));
  wall.position = { x: 500, z: 175, y: 2000, rotation: 0 };
  assert.ok(placementIssues(kitchen([wall])).some(i => i.code === 'ceiling'));
  wall.position.y = 1200; wall.autoElevation = false;
  assert.ok(placementIssues(kitchen([cabinet('b', 500), wall])).some(i => i.code === 'clearance' && i.severity === 'error'));
});
test('automatic upper height follows bases/top thickness and preserves manual elevation', () => {
  const base = { ...cabinet('b', 500), height: 900 }, wall = cabinet('w', 500, 175, 'wall');
  const k = resolveElevations({ ...kitchen([base, wall]), countertop: { thickness: 40, frontOverhang: 20, material: 'wood' }, wallClearance: 500 });
  assert.equal(k.cabinets[1].position.y, 1440); assert.equal(wallCabinetClearance(k.cabinets[1], k), 500);
  const manual = { ...wall, autoElevation: false, position: { ...wall.position, y: 1500 } };
  assert.equal(resolveElevations(kitchen([base, manual])).cabinets[1].position.y, 1500);
});
test('tall cabinets follow ceiling and never create countertop', () => {
  const tall = createCabinet('tall', 't');
  const k = resolveElevations({ ...kitchen([tall]), room: { width: 4000, depth: 3000, height: 2800 } });
  assert.equal(k.cabinets[0].height, 2800); assert.equal(k.cabinets[0].position.y, 0);
  assert.deepEqual(fitCountertops(k), []); assert.deepEqual(placementIssues(k), []);
});
test('auto-fit splits at a removed cabinet, and joins again after moving into the gap', () => {
  const a = cabinet('a', 300), b = cabinet('b', 900), c = cabinet('c', 1500);
  assert.equal(fitCountertops(kitchen([c, a, b]))[0].width, 1800);
  const removed = kitchen([a, c]); assert.equal(fitCountertops(removed).length, 2);
  const moved = proposeCabinetMove(removed, 'c', { ...c.position, x: 950 });
  assert.equal(moved.neighbourId, 'a'); assert.equal(fitCountertops(moved.kitchen)[0].width, 1200);
  assert.equal(c.position.x, 1500, 'proposal must not mutate committed design');
});
test('countertops split at different depths, heights and turns; rotated centre is correct', () => {
  const a = cabinet('a', 3700, 400), b = cabinet('b', 3700, 1000);
  a.position.rotation = b.position.rotation = -Math.PI / 2;
  const top = fitCountertops(kitchen([a, b]))[0]; near(top.width, 1200); near(top.position.x, 3690); near(top.position.z, 700);
  assert.equal(fitCountertops(kitchen([a, { ...b, height: 850 }])).length, 2);
  assert.equal(fitCountertops(kitchen([a, { ...b, depth: 650 }])).length, 2);
  assert.equal(fitCountertops(kitchen([a, { ...b, position: { ...b.position, rotation: 0 } }])).length, 2);
});
test('move proposals expose errors for preview without mutating committed state', () => {
  const k = kitchen([cabinet('a', 300), cabinet('b', 900)]), before = JSON.stringify(k);
  const result = proposeCabinetMove(k, 'b', { x: 350, y: 0, z: 300, rotation: 0 });
  assert.ok(result.issues.some(i => i.code === 'overlap'));
  assert.equal(JSON.stringify(k), before);
});
test('adding finds valid free positions and reports a full room without altering it', () => {
  let k = createModularKitchen();
  for (const type of ['base', 'wall', 'tall']) {
    const next = findCabinetSpace(k, createCabinet(type, type + '-added', 800));
    assert.ok(next); assert.equal(next.cabinets.length, k.cabinets.length + 1);
    assert.ok(!placementIssues(next).some(i => i.severity === 'error')); k = next;
  }
  const full = { ...kitchen([cabinet('full', 300)]), room: { width: 600, depth: 600, height: 2600 } };
  assert.equal(findCabinetSpace(full, createCabinet('base', 'new')), null);
});
