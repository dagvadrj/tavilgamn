const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { parseKitchenSpace, resizeKitchenRoom, spaceItemCandidates } = loadSource('src/lib/kitchenSpace.ts');
const { createUnifiedKitchen, parseKitchen, cloneKitchen } = loadSource('src/lib/kitchenAssembly.ts');
const { roomWalls } = loadSource('src/lib/kitchenCabinets.ts');
const { placementIssues } = loadSource('src/lib/kitchenPlacement.ts');

test('room elements survive kitchen saving and open-front rooms omit the front wall', () => {
  const kitchen = createUnifiedKitchen();
  kitchen.room.openFront = true;
  kitchen.room.items = [{ id: 'water-point', kind: 'water', x: 1500, z: 1000, width: 100, depth: 100, wall: 'back' }];
  assert.deepEqual(parseKitchen(cloneKitchen(kitchen)).room, kitchen.room);
  assert.equal(roomWalls(kitchen.room).length, 3);
  assert.ok(!roomWalls(kitchen.room).some(wall => wall.id === 'front'));
});

test('openings and columns must fit their room and wall', () => {
  const room = { width: 4000, depth: 4000, height: 2700 };
  const door = { id: 'door', kind: 'door', x: 2000, z: 0, width: 900, depth: 100, wall: 'back' };
  assert.equal(parseKitchenSpace({ ...room, items: [door] }).items.length, 1);
  assert.throws(() => parseKitchenSpace({ ...room, items: [{ ...door, x: 100 }] }));
  assert.throws(() => parseKitchenSpace({ ...room, items: [door, door] }));
  assert.throws(() => parseKitchenSpace({ ...room, items: [{ ...door, kind: 'column', z: 20 }] }));
  assert.throws(() => parseKitchenSpace({ ...room, openFront: true, items: [{ ...door, wall: 'front', z: 4000 }] }));
});

test('columns cannot overlap kitchen cabinets', () => {
  const kitchen = createUnifiedKitchen();
  const cabinet = kitchen.cabinets.find(c => c.type === 'base');
  kitchen.room.items = [{ id: 'column', kind: 'column', x: cabinet.position.x, z: cabinet.position.z, width: 200, depth: 200, wall: 'back' }];
  assert.ok(placementIssues(kitchen).some(issue => issue.code === 'overlap' && issue.message.includes('багана')));
});

test('door clearance blocks furniture even when its centre is inside the room', () => {
  const kitchen = createUnifiedKitchen();
  const cabinet = kitchen.cabinets.find(c => c.type === 'base');
  kitchen.room.items = [{ id: 'door', kind: 'door', x: cabinet.position.x, z: 0, width: 900, depth: 100, wall: 'back' }];
  assert.ok(placementIssues(kitchen).some(issue => issue.ids.includes('door') && issue.message.includes('нээгдэх зай')));
});

test('resizing keeps openings attached to the correct wall', () => {
  const room = { width: 4000, depth: 4000, height: 2700, items: [{ id: 'window', kind: 'window', x: 4000, z: 2000, width: 1200, depth: 100, wall: 'right' }] };
  const next = resizeKitchenRoom(room, { width: 3000, depth: 2500 });
  assert.equal(next.items[0].x, 3000);
  assert.equal(next.items[0].z, 1250);
  assert.equal(room.items[0].x, 4000);
});

test('wall openings cannot overlap and additions can find the next available position', () => {
  const door = { id: 'door', kind: 'door', x: 2000, z: 0, width: 900, depth: 100, wall: 'back' };
  const room = { width: 4000, depth: 4000, height: 2700, items: [door] };
  assert.throws(() => parseKitchenSpace({ ...room, items: [door, { ...door, id: 'window', kind: 'window' }] }), /давхцаж/);
  const candidate = spaceItemCandidates(room, 'window', 'back', 'new-window').find(item => {
    try { parseKitchenSpace({ ...room, items: [...room.items, item] }); return true; } catch { return false; }
  });
  assert.ok(candidate);
  assert.notEqual(candidate.x, door.x);
});
