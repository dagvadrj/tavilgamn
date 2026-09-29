const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');
const { getFurnitureMeasurements, formatMeasurement } = loadSource('src/lib/furnitureMeasurements.ts');
const room = { width: 6, depth: 4, height: 2.7 };
const piece = { instanceId: 'one', productId: 'sofa', x: 0, z: 0, rotation: 0, color: 'oak', material: 'wood' };
const dims = { w: 2, d: 1, h: 2 };
const measure = (shape = room, placement = piece, size = dims) => Object.fromEntries(getFurnitureMeasurements(shape, placement, size).map(m => [m.id, m]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('measures furniture dimensions, four wall gaps, and ceiling from the top surface', () => {
  const m = measure();
  near(m.width.value, 2); near(m.depth.value, 1); near(m.height.value, 2);
  near(m.west.value, 2); near(m.east.value, 2); near(m.north.value, 1.5); near(m.south.value, 1.5);
  near(m.ceiling.value, .7);
  assert.deepEqual(m.ceiling.from, [0, 2, 0]); assert.deepEqual(m.ceiling.to, [0, 2.7, 0]);
  assert.equal(formatMeasurement(.143), '14.3 см');
});

test('rotation preserves product size and uses the closest rotated corner for each wall', () => {
  for (let degree = 0; degree < 360; degree += 15) {
    const rotation = degree * Math.PI / 180;
    const cos = Math.abs(Math.cos(rotation)), sin = Math.abs(Math.sin(rotation));
    const m = measure(room, { ...piece, x: .2, z: -.1, rotation });
    near(m.width.value, dims.w); near(m.depth.value, dims.d);
    near(m.west.value, 3.2 - (dims.w * cos + dims.d * sin) / 2);
    near(m.east.value, 2.8 - (dims.w * cos + dims.d * sin) / 2);
    near(m.north.value, 1.9 - (dims.w * sin + dims.d * cos) / 2);
    near(m.south.value, 2.1 - (dims.w * sin + dims.d * cos) / 2);
    for (const line of Object.values(m)) near(Math.hypot(...line.to.map((v, i) => v - line.from[i])), Math.abs(line.value));
  }
});

test('a narrow protrusion at the edge of the furniture is measured even off its centre line', () => {
  const m = measure({ ...room, wallFeatures: [{ id: 'f', wall: 'north', kind: 'inset', offset: 3.7, length: .3, depth: .5 }] });
  near(m.north.value, 1);
  assert.ok(m.north.to[0] >= .7 && m.north.to[0] <= 1);
  near(m.north.to[2], -1.5);
});

test('a recess is measured to its real back wall and a distant protrusion is ignored', () => {
  const m = measure({ ...room, wallFeatures: [{ id: 'f', wall: 'north', kind: 'recess', offset: 1, length: 4, depth: .6 }] });
  near(m.north.value, 2.1); near(m.north.to[2], -2.6);
  const distant = measure({ ...room, wallFeatures: [{ id: 'f', wall: 'north', kind: 'inset', offset: 0, length: .5, depth: 1 }] });
  near(distant.north.value, 1.5);
});

test('the nearest column face replaces the further wall, and deletion updates the gap', () => {
  const column = { id: 'c', x: 4.4, z: 1.8, width: .3, depth: .4 };
  const shape = { ...room, columns: [column] };
  const m = measure(shape);
  near(m.east.value, .4); assert.match(m.east.label, /багана/);
  near(measure({ ...shape, columns: [] }).east.value, 2);
  near(measure({ ...room, columns: [{ ...column, z: 2.8 }] }).east.value, 2);
});

test('contact remains zero and new room/ceiling sizes update without stale values', () => {
  near(measure(room, { ...piece, x: 2 }).east.value, 0);
  near(measure({ ...room, height: 2 }).ceiling.value, 0);
  near(measure({ ...room, width: 8, height: 3 }).east.value, 3);
  near(measure({ ...room, width: 8, height: 3 }).ceiling.value, 1);
  assert.deepEqual(getFurnitureMeasurements(room, piece, { ...dims, w: NaN }), []);
});

test('measurement dimensions use uploaded model metadata before catalogue dimensions', () => {
  const { dimsFor } = loadSource('src/three/collision.ts', {
    '@/store/catalog': { getProduct: () => ({ dimensions: dims }) },
    '@/lib/modelRegistry': { getDbModel: () => ({ dimensionsW: 3, dimensionsD: .5, dimensionsH: 2.4 }) },
  });
  assert.deepEqual(dimsFor(piece), dims);
  const uploaded = dimsFor({ ...piece, modelId: 'uploaded' });
  assert.deepEqual(uploaded, { w: 3, d: .5, h: 2.4 });
  near(measure(room, piece, uploaded).ceiling.value, .3);
});

function nodes(node) {
  return !node || typeof node !== 'object' ? [] : [node, ...React.Children.toArray(node.props?.children).flatMap(nodes)];
}

test('Measure click selects the piece without moving it, capturing a pointer or starting history', () => {
  let selected, moved = 0, started = 0, ended = 0, captured = 0;
  const react = { ...React, useState: init => [typeof init === 'function' ? init() : init, () => {}], useRef: value => ({ current: value }), useEffect: () => {} };
  const { RoomCanvas } = loadSource('src/three/RoomCanvas.tsx', {
    react,
    '@react-three/fiber': { Canvas: 'canvas', useThree: () => ({ camera: {}, raycaster: {}, gl: {} }) },
    '@react-three/drei': new Proxy({}, { get: (_, key) => key === 'useCursor' ? () => {} : String(key) }),
    '@/store/catalog': { getProduct: () => ({ dimensions: dims }) },
    '@/lib/modelRegistry': { getDbModel: () => undefined },
    './FurnitureMesh': { FurnitureMesh: 'furniture' }, './GLBFurnitureMesh': { GLBFurnitureMesh: 'glb' },
    './InteriorModel': { InteriorModel: 'interior' }, './FurnitureMeasurements': { FurnitureMeasurements: 'measurements' },
  });
  const props = { design: { ...room, pieces: [piece] }, selected: null, onSelect: id => selected = id,
    onMove: () => moved++, onEditStart: () => started++, onEditEnd: () => ended++, view: 'plan', snapEnabled: true, locked: false };
  const tree = RoomCanvas({ ...props, showDimensions: true });
  const draggable = nodes(tree).find(n => n.type?.name === 'DraggablePiece');
  assert.equal(draggable.props.measureMode, true);
  const mesh = draggable.type(draggable.props);
  mesh.props.onPointerDown({ button: 0, stopPropagation() {}, target: { setPointerCapture() { captured++; } } });
  mesh.props.onPointerMove({}); mesh.props.onPointerUp({});
  assert.equal(selected, piece.instanceId); assert.equal(moved, 0); assert.equal(started, 0); assert.equal(ended, 0); assert.equal(captured, 0);
  assert.equal(nodes(RoomCanvas({ ...props, showDimensions: false })).find(n => n.type?.name === 'DraggablePiece').props.measureMode, false);
  const measured = RoomCanvas({ ...props, selected: 'one', showDimensions: true, measurements: getFurnitureMeasurements(room, piece, dims) });
  assert.equal(nodes(measured).filter(n => n.type === 'measurements').length, 1);
  assert.equal(nodes(RoomCanvas({ ...props, selected: 'one', showDimensions: false })).filter(n => n.type === 'measurements').length, 0);
});

test('2D avoids collapsed vertical lines while 3D includes height and ceiling', () => {
  const { FurnitureMeasurements } = loadSource('src/three/FurnitureMeasurements.tsx', { '@react-three/drei': { Html: 'html', Line: 'line' } });
  const measurements = getFurnitureMeasurements(room, piece, dims);
  const plan = nodes(FurnitureMeasurements({ measurements, view: 'plan' })).filter(n => n.props?.measurement);
  const perspective = nodes(FurnitureMeasurements({ measurements, view: 'perspective' })).filter(n => n.props?.measurement);
  assert.equal(plan.length, 6); assert.equal(perspective.length, 8);
  assert.ok(plan.every(n => !n.props.measurement.vertical));
});
