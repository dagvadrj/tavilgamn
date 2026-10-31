const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { createCabinet } = loadSource('src/lib/kitchenCabinets.ts');
const { placeholderFronts, PLACEHOLDER_FRONT_GAP } = loadSource('src/lib/kitchenPlaceholderFronts.ts');
const { createKitchenCameraPoseStore } = loadSource('src/lib/kitchenCameraPose.ts');

test('placeholder fronts split doors and drawers inside the cabinet face', () => {
  const base = { ...createCabinet('base', 'a', 800), doorCount: 2, drawerCount: 1, opening: 'doors' };
  const fronts = placeholderFronts(base);
  assert.deepEqual(fronts.map(f => f.kind), ['drawer', 'door', 'door']);
  for (const f of fronts) {
    assert.ok(f.x >= 0 && f.x + f.width <= base.width + 1e-9, 'within the width');
    assert.ok(f.y >= 0 && f.y + f.height <= base.height + 1e-9, 'within the height');
  }
  const [drawer, left, right] = fronts;
  assert.ok(Math.abs(right.x - (left.x + left.width) - PLACEHOLDER_FRONT_GAP) < 1e-9, 'doors leave one gap between them');
  assert.ok(Math.abs(drawer.y - (left.y + left.height) - PLACEHOLDER_FRONT_GAP) < 1e-9, 'drawer sits one gap above the doors');
  assert.ok(left.y > 0, 'base fronts start above the plinth');
});

test('drawer stacks fill the face; open shelving and appliances get no fronts', () => {
  const drawers = placeholderFronts({ ...createCabinet('base', 'b', 600), opening: 'drawers', drawerCount: 3 });
  assert.equal(drawers.length, 3);
  assert.ok(drawers.every(f => f.kind === 'drawer'));
  assert.deepEqual(placeholderFronts({ ...createCabinet('wall', 'c', 600), opening: 'open' }), []);
  assert.deepEqual(placeholderFronts({ ...createCabinet('wall', 'd', 600), opening: 'hood' }), []);
  const wall = placeholderFronts({ ...createCabinet('wall', 'e', 400), doorCount: 1, drawerCount: 0 });
  assert.equal(wall.length, 1);
  assert.equal(wall[0].y, PLACEHOLDER_FRONT_GAP / 2, 'wall cabinets have no plinth');
});

test('camera pose store notifies only on a visible move', () => {
  const store = createKitchenCameraPoseStore();
  let calls = 0;
  const stop = store.subscribe(() => calls++);
  store.set({ x: 0, z: 0, dirX: 1, dirZ: 0 });
  store.set({ x: 5, z: 5, dirX: 1, dirZ: 0.005 });
  assert.equal(calls, 1, 'sub-step jitter is ignored');
  store.set({ x: 100, z: 0, dirX: 1, dirZ: 0 });
  assert.equal(calls, 2);
  assert.equal(store.get().x, 100);
  stop();
  store.set({ x: 900, z: 0, dirX: 0, dirZ: 1 });
  assert.equal(calls, 2, 'unsubscribed listeners stay quiet');
});

const { kitchenFacingSide } = loadSource('src/lib/kitchenCameraPose.ts');
const { parseKitchenSpace } = loadSource('src/lib/kitchenSpace.ts');
const { addRoomOpening } = loadSource('src/lib/kitchenOpenings.ts');
const { createUnifiedKitchen } = loadSource('src/lib/kitchenAssembly.ts');

test('without a window the camera opens in front of the cabinets', () => {
  assert.equal(kitchenFacingSide([]), null);
  // Back-wall run faces +z, so the camera stands toward the front of the room.
  const [x, z] = kitchenFacingSide([{ width: 2400, position: { rotation: 0 } }]);
  assert.ok(z > 0.7 && Math.abs(Math.hypot(x, z) - 1) < 1e-9);
  // An L (back run + left run facing +x) opens on its corner.
  const [lx, lz] = kitchenFacingSide([{ width: 2000, position: { rotation: 0 } }, { width: 2000, position: { rotation: Math.PI / 2 } }]);
  assert.ok(lx > 0 && lz > 0);
});

test('floor material is kept when known and rejected otherwise', () => {
  const room = { width: 3000, depth: 3000, height: 2600 };
  assert.equal(parseKitchenSpace({ ...room, floorMaterial: 'tile-ceramic' }).floorMaterial, 'tile-ceramic');
  assert.equal(parseKitchenSpace(room).floorMaterial, undefined);
  assert.throws(() => parseKitchenSpace({ ...room, floorMaterial: 'carpet-sand' }), /Шалны материал/);
});

test('one-tap window and door land on a free wall and keep the room valid', () => {
  const kitchen = createUnifiedKitchen();
  const withWindow = addRoomOpening(kitchen, 'window', 'w1');
  assert.ok(withWindow);
  const window = withWindow.items.find(item => item.id === 'w1');
  assert.equal(window.kind, 'window');
  parseKitchenSpace(withWindow);
  const withDoor = addRoomOpening({ ...kitchen, room: withWindow }, 'door', 'd1');
  assert.ok(withDoor.items.some(item => item.id === 'd1' && item.kind === 'door'));
  parseKitchenSpace(withDoor);
});
