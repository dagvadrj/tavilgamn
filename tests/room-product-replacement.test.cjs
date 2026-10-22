const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const products = new Map();
const mocks = { '@/store/catalog': { getProduct: id => products.get(id) } };
const { replaceRoomProduct } = loadSource('src/lib/roomProductReplacement.ts', mocks);
const { isPlacementValid } = loadSource('src/three/collision.ts', mocks);
const room = { width: 5, depth: 4, height: 2.7 };
function product(id, width = .8, extra = {}) {
  const p = { id, name: id, category: 'side-table', model: { id, file: 'model.glb' }, dimensions: { w: width, d: .6, h: .7 },
    colors: [{ id: 'oak', hex: '#b99165' }], materials: [{ id: 'wood', priceDelta: 0 }], defaultColor: 'oak', inStock: true, stockQuantity: 10, ...extra };
  products.set(id, p); return p;
}
function piece(id, p, extra = {}) { return { instanceId: id, productId: p.id, x: 0, z: 0, rotation: .2, color: 'oak', material: 'wood',
  details: { name: p.name, dimensions: p.dimensions }, ...extra }; }

test('replacement retains selection and pose, clears stale models and rejects collisions atomically', () => {
  const old = product('old'), next = product('new');
  const a = piece('a', old, { modelId: 'obsolete' });
  const original = structuredClone(a);
  const result = replaceRoomProduct(a, next, [a], room, 'room');
  assert.equal(result.error, null); assert.equal(result.pieces[0].instanceId, 'a');
  assert.equal(result.pieces[0].rotation, .2); assert.equal(result.pieces[0].modelId, undefined);
  const large = product('large', 9);
  assert.equal(replaceRoomProduct(a, large, [a], room, 'room').pieces, null);
  assert.deepEqual(a, original);
  const wall = product('wall', .8, { placement: { surfaces: ['wall'] } });
  assert.equal(replaceRoomProduct(a, wall, [a], room, 'room').pieces, null);
});

test('replacing a support validates its dependent objects and never detaches them silently', () => {
  const table = product('table', 1, { placement: { surfaces: ['floor'], supportSurfaces: [{ id: 'top', width: 1, depth: .6, elevation: .7 }] } });
  const lamp = product('lamp', .2, { dimensions: { w: .2, d: .2, h: .3 }, placement: { surfaces: ['surface'] } });
  const a = piece('table', table, { placement: table.placement, rotation: 0 });
  const b = piece('lamp', lamp, { placement: lamp.placement, elevation: .7, rotation: 0,
    attachment: { kind: 'surface', parentInstanceId: 'table', surfaceId: 'top', localPosition: [0, .7, 0], localQuaternion: [0, 0, 0, 1] } });
  const noSupport = product('no-support', 1);
  assert.equal(replaceRoomProduct(a, noSupport, [a, b], room, 'room').pieces, null);
  const compatible = product('compatible', 1, { placement: table.placement });
  const result = replaceRoomProduct(a, compatible, [a, b], room, 'room');
  assert.equal(result.error, null); assert.equal(result.pieces[1].attachment.parentInstanceId, 'table');
});

test('door swing remains reserved while closed; furniture below a window sill stays valid', () => {
  const p = product('cabinet', .6), a = piece('a', p, { rotation: 0, x: 0, z: -1.4 });
  const door = { id: 'door', kind: 'door', wallId: 'north', position: .5, width: .9, height: 2.1, sillHeight: 0, swing: 'inward', open: false };
  assert.equal(isPlacementValid(a, [], { ...room, openings: [door] }), false);
  assert.equal(isPlacementValid(a, [], { ...room, openings: [{ ...door, swing: 'outward' }] }), true);
  const flush = { ...a, z: -1.7 };
  const window = { ...door, kind: 'window', sillHeight: .9, height: 1.1 };
  assert.equal(isPlacementValid(flush, [], { ...room, openings: [window] }), true);
  products.set('cabinet', { ...p, dimensions: { ...p.dimensions, h: 1.5 } });
  assert.equal(isPlacementValid(flush, [], { ...room, openings: [window] }), false);
});
