const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const THREE = require('three');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadSource } = require('./helpers/load-source.cjs');
const model = loadSource('src/lib/kitchenAssembly.ts');
const { createCabinet } = loadSource('src/lib/kitchenCabinets.ts');
const placement = loadSource('src/lib/kitchenPlacement.ts');
const { kitchenRoomPiece } = loadSource('src/lib/kitchenRoomPiece.ts');
const mocks = { '@/store/catalog': { getProduct: () => undefined }, '@/lib/modelRegistry': { getDbModel: () => undefined } };
const collision = loadSource('src/three/collision.ts', mocks);
const saved = design => ({ id: '12345678-1234-1234-1234-123456789abc', name: 'Миний гал тогоо', design });
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);

test('unified design preserves appearance and IDs across all three layouts and JSON roundtrip', () => {
  const base = model.createUnifiedKitchen();
  const schema = new (require('ajv'))().compile(JSON.parse(require('node:fs').readFileSync('src/lib/cabinet.schema.json','utf8')));
  for (const c of base.cabinets) assert.equal(schema(c),true,JSON.stringify(schema.errors));
  const styled = model.applyKitchenAppearance(base, null, { finish: 'walnut', handleStyle: 'knob', color: '#123456', frontStyle: 'shaker' });
  const selected = model.applyKitchenAppearance(styled, ['base-1'], { color: '#ffffff' });
  assert.equal(selected.cabinets.find(c => c.id === 'base-2').color, '#123456');
  for (const layout of ['straight', 'l-left', 'l-right']) {
    const next = model.arrangeKitchen(selected, layout);
    assert.deepEqual(placement.placementIssues(next).filter(i => i.severity === 'error'), []);
    assert.deepEqual(model.parseKitchen(JSON.parse(JSON.stringify(next))), next);
    assert.deepEqual(next.cabinets.map(c => [c.id, c.width, c.finish, c.handleStyle]), selected.cabinets.map(c => [c.id, c.width, c.finish, c.handleStyle]));
  }
  assert.equal(base.cabinets[0].finish, 'oak');
});

test('JSON rejects invalid sizes, overlaps, duplicate IDs and unsupported appliance openings', () => {
  const k = model.createUnifiedKitchen();
  for (const mutate of [k => k.cabinets[0].width = 500, k => k.cabinets[1].id = k.cabinets[0].id,
    k => k.cabinets[2].position.x = k.cabinets[0].position.x, k => k.cabinets[1].opening = 'sink',
    k => k.cabinets[0].position.rotation = NaN, k => k.countertop.finish = 'invalid', k => k.cabinets = []]) {
    const next = model.cloneKitchen(k); mutate(next); assert.throws(() => model.parseKitchen(next));
  }
  const next = model.parseKitchen({ ...k, secret: 'ignored', room: { ...k.room, injected: 1 } });
  assert.equal(next.secret, undefined); assert.equal(next.room.injected, undefined);
});

// Build actual Three geometries from the shared renderer without a browser or WebGL.
// Texture generation and React effects are irrelevant to physical bounds.
const { KitchenAssemblyMesh } = loadSource('src/three/KitchenAssemblyMesh.tsx', {
  react: { ...React, useMemo: fn => fn(), useEffect: () => {} },
  './kitchenTextures': { createKitchenTexture: () => null },
});
function scene(node, parent = new THREE.Group()) {
  for (const element of React.Children.toArray(node)) {
    if (!React.isValidElement(element)) continue;
    if (typeof element.type === 'function') { scene(element.type(element.props), parent); continue; }
    if (typeof element.type === 'symbol') { scene(element.props.children, parent); continue; }
    const geometry = { boxGeometry: THREE.BoxGeometry, sphereGeometry: THREE.SphereGeometry, ringGeometry: THREE.RingGeometry, extrudeGeometry: THREE.ExtrudeGeometry }[element.type];
    if (geometry) { parent.geometry = new geometry(...element.props.args); continue; }
    if (!['mesh', 'group'].includes(element.type)) continue;
    const object = element.type === 'mesh' ? new THREE.Mesh() : new THREE.Group();
    if (element.props.position) object.position.fromArray(element.props.position);
    if (element.props.rotation) object.rotation.fromArray(element.props.rotation);
    parent.add(object); scene(element.props.children, object);
  }
  return parent;
}
test('shared 3D mesh matches declared millimetres including handles, taps and rotated L runs', () => {
  for (const layout of ['straight', 'l-left', 'l-right']) for (const handleStyle of ['bar', 'knob', 'push-open']) {
    const k = model.arrangeKitchen(model.applyKitchenAppearance(model.createUnifiedKitchen(), null, { handleStyle }), layout);
    const rendered = scene(React.createElement(KitchenAssemblyMesh, { kitchen: k, centered: true }));
    const box = new THREE.Box3().setFromObject(rendered), size = box.getSize(new THREE.Vector3()), declared = model.kitchenEnvelope(k);
    near(size.x, declared.w); near(size.y, declared.h); near(size.z, declared.d);
    near(box.getCenter(new THREE.Vector3()).x, 0); near(box.getCenter(new THREE.Vector3()).z, 0);
    rendered.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
  }
  const k = model.createUnifiedKitchen(); k.backsplash = false; k.cabinets = k.cabinets.filter(c => c.opening === 'sink');
  near(model.kitchenEnvelope(k).h, 1.11);
  const rendered = scene(React.createElement(KitchenAssemblyMesh, { kitchen: k }));
  near(new THREE.Box3().setFromObject(rendered).max.y, 1.11);
});

test('room snapshot survives saved-design mutation and room cloning without scaling', () => {
  const k = model.createUnifiedKitchen(), piece = kitchenRoomPiece(saved(k), 'placed');
  const expected = model.kitchenEnvelope(k);
  k.cabinets[0].width = 300;
  assert.equal(piece.kitchen.design.cabinets[0].width, 600);
  assert.deepEqual(collision.dimsFor(piece), { w: expected.w, d: expected.d, h: expected.h });
  const { cloneRoom } = loadSource('src/lib/roomDesign.ts');
  const room = { id: 'room', width: 5, depth: 5, height: 2.7, pieces: [piece] };
  const copy = cloneRoom(room); copy.pieces[0].kitchen.design.cabinets[0].width = 400;
  assert.equal(piece.kitchen.design.cabinets[0].width, 600);
  assert.deepEqual(JSON.parse(JSON.stringify(room)).pieces[0].kitchen, piece.kitchen);
});

test('exact fitting room accepts kitchen, undersized room and low ceiling reject it', () => {
  const piece = kitchenRoomPiece(saved(model.createUnifiedKitchen()), 'p');
  const { w, d, h } = collision.dimsFor(piece), room = { width: w, depth: 2, height: h };
  const positioned = collision.findFreePlacement({ ...piece, x: 20 }, [], room);
  assert.ok(positioned); near(positioned.x, 0); assert.deepEqual(positioned.kitchen, piece.kitchen);
  assert.equal(collision.findFreePlacement(piece, [], { ...room, width: w - .001 }), null);
  assert.equal(collision.findFreePlacement(piece, [], { ...room, height: h - .001 }), null);
  assert.equal(collision.isPlacementValid({ ...piece, rotation: Math.PI / 2 }, [], { width: 2, depth: w, height: h }), true);
  assert.ok(d > .6);
});

test('L empty corner remains usable while columns and furniture intersecting its cabinets reject placement', () => {
  const k = model.arrangeKitchen(model.createUnifiedKitchen(), 'l-left');
  const piece = kitchenRoomPiece(saved(k), 'k');
  const env = model.kitchenEnvelope(k), room = { width: 6, depth: 6, height: 2.7 };
  const toWorld = (x,z) => ({ x: (x - env.centerX)/1000, z: (z - env.centerZ)/1000 });
  const empty = { instanceId: 'box', productId: 'box', rotation: 0, ...toWorld(1300,1300) };
  assert.equal(collision.isPlacementValid(piece, [empty], room), true);
  const hit = { ...empty, ...toWorld(300,900) };
  assert.equal(collision.isPlacementValid(piece, [hit], room), false);
  const column = { id: 'c', x: hit.x + 3, z: hit.z + 3, width: .1, depth: .1 };
  assert.equal(collision.isPlacementValid(piece, [], { ...room, columns: [column] }), false);
});

test('plan markup contains measured wall segments, current furniture and immediate column removal', () => {
  const { RoomPlanPreview } = loadSource('src/components/RoomPlanPreview.tsx', mocks);
  const room = { width: 5, depth: 4, height: 2.7, wallFeatures: [{ id:'notch',wall:'north',kind:'inset',offset:0,length:.6,depth:.2 }], columns:[{id:'c',x:2,z:2,width:.3,depth:.3}] };
  const piece = kitchenRoomPiece(saved(model.createUnifiedKitchen()), 'p');
  const render = room => renderToStaticMarkup(React.createElement(RoomPlanPreview, { room, pieces: [piece] }));
  const html = render(room); assert.match(html,/5000 мм/); assert.match(html,/4000 мм/); assert.match(html,/Х6/);
  assert.match(html,/room-plan-column/); assert.match(html,/room-plan-furniture/);
  assert.doesNotMatch(render({ ...room, columns: [] }), /room-plan-column/);
});
