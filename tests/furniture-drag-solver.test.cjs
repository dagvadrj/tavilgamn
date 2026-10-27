const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { solveDragPoint, floorSlideDirections, clampDragPoint } = loadSource('src/three/furnitureDragSolver.ts');
const { isPlacementValid } = loadSource('src/three/collision.ts');
const { roomTemplateOutline } = loadSource('src/lib/roomPolygon.ts');
const { getRoomGeometry } = loadSource('src/lib/roomGeometry.ts');

const rect = { width: 5, depth: 4, height: 2.7, outline: roomTemplateOutline('rectangle', 5, 4) };
const piece = (patch = {}) => ({ instanceId: 'p', productId: 'unknown', x: 0, z: 0, rotation: 0, details: { name: 'Box', dimensions: { w: 1, d: 0.6, h: 0.8 } }, ...patch });
const near = (a, b, eps = 2e-3) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

function drag(room, base, to, from = [base.x, base.z]) {
  const accept = p => isPlacementValid({ ...base, x: p[0], z: p[1] }, [], room);
  const target = clampDragPoint(to, getRoomGeometry(room).bounds);
  const point = solveDragPoint({ from, to: target, accept, directions: floorSlideDirections(room, target) });
  assert.ok(accept(point), 'the solver only returns collision-valid placements');
  return point;
}

test('a cursor beyond each of the four walls slides the full footprint along that wall', () => {
  const { minX, maxX, minZ, maxZ } = getRoomGeometry(rect).bounds, base = piece();
  near(drag(rect, base, [20, 0.7])[0], maxX - 0.5); near(drag(rect, base, [20, 0.7])[1], 0.7);
  near(drag(rect, base, [-20, -0.4])[0], minX + 0.5); near(drag(rect, base, [-20, -0.4])[1], -0.4);
  near(drag(rect, base, [1.1, 20])[1], maxZ - 0.3); near(drag(rect, base, [1.1, 20])[0], 1.1);
  near(drag(rect, base, [-1.3, -20])[1], minZ + 0.3); near(drag(rect, base, [-1.3, -20])[0], -1.3);
  // Moving the cursor along the outside of a wall keeps the piece moving with it.
  let from = [0, 0];
  for (let z = -1.5; z <= 1.5; z += 0.25) {
    from = drag(rect, base, [9, z], from);
    near(from[0], maxX - 0.5); near(from[1], z);
  }
});

test('corners hold steadily and the piece follows back inside without sticking', () => {
  const { maxX, maxZ } = getRoomGeometry(rect).bounds, base = piece();
  let point = [0, 0];
  for (let i = 0; i < 5; i++) {
    point = drag(rect, { ...base, x: point[0], z: point[1] }, [15, 15], point);
    near(point[0], maxX - 0.5); near(point[1], maxZ - 0.3);
  }
  const back = drag(rect, { ...base, x: point[0], z: point[1] }, [0.4, -0.2], point);
  assert.deepEqual(back, [0.4, -0.2]);
});

test('rotation changes the contact distance to the real rotated footprint', () => {
  const { maxX } = getRoomGeometry(rect).bounds;
  near(drag(rect, piece({ rotation: Math.PI / 2 }), [20, 0])[0], maxX - 0.3);
  const diagonal = drag(rect, piece({ rotation: Math.PI / 4 }), [20, 0])[0];
  near(diagonal, maxX - (0.5 + 0.3) * Math.SQRT1_2);
});

test('L-shaped rooms block the missing quadrant and slide along both notch walls', () => {
  const room = { width: 5, depth: 4, height: 2.7, outline: roomTemplateOutline('l', 5, 4) };
  const base = piece({ x: 1.2, z: 1.2 });
  const point = drag(room, base, [-1.5, 1.2]);
  // The notch edge is x = 0: the footprint stops there instead of entering it.
  near(point[0], 0.5); near(point[1], 1.2);
  const upper = drag(room, piece({ x: -1.2, z: -1.2 }), [-1.2, 1.5]);
  near(upper[1], -0.3); near(upper[0], -1.2);
});

test('a column stops the path; points inside it never tunnel to the far side', () => {
  const room = { width: 5, depth: 4, height: 2.7, columns: [{ id: 'c', x: 2.3, z: 1.6, width: 0.4, depth: 0.8 }] };
  const geometry = getRoomGeometry(room), column = geometry.voids[0];
  assert.ok(column, 'column is part of the placement geometry');
  const z = (column.minZ + column.maxZ) / 2;
  const point = drag(room, piece({ x: geometry.bounds.minX + 0.8, z }), [(column.minX + column.maxX) / 2, z]);
  near(point[0], column.minX - 0.5);
});

test('fully blocked motion stays at the nearest accepted point and never returns invalid input', () => {
  const base = piece({ details: { name: 'Huge', dimensions: { w: 4.9, d: 3.9, h: 0.8 } } });
  // 4.9 × 3.9 in a 5 × 4 room leaves 5 cm per axis: it reaches that corner and stops.
  const point = drag(rect, base, [6, 6]);
  near(point[0], 0.05); near(point[1], 0.05);
  assert.deepEqual(solveDragPoint({ from: [0, 0], to: [NaN, 1], accept: () => true, directions: [] }), [0, 0]);
});

test('solving a wall contact stays within a per-frame budget', () => {
  const room = { width: 6, depth: 5, height: 2.7, outline: roomTemplateOutline('u', 6, 5) };
  const base = piece();
  const start = performance.now();
  let point = [0, -1.5];
  for (let i = 0; i < 120; i++) point = drag(room, { ...base, x: point[0], z: point[1] }, [Math.cos(i / 9) * 12, Math.sin(i / 9) * 12], point);
  const average = (performance.now() - start) / 120;
  assert.ok(average < 8, `average solve ${average.toFixed(2)} ms`);
});
