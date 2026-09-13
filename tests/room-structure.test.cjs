const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { computeMeshVolume } = require('three-bvh-csg');
const { loadSource } = require('./helpers/load-source.cjs');
const { createWallGeometry } = loadSource('src/three/wallCsg.ts');
const { openingWorldTransform, createOpening } = loadSource('src/lib/roomOpenings.ts');

function rayHits(geometry, x, elevation, wallHeight = 2.7) {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld();
  const result = new THREE.Raycaster(new THREE.Vector3(x, elevation - wallHeight / 2, 1), new THREE.Vector3(0, 0, -1)).intersectObject(mesh);
  material.dispose();
  return result;
}

test('CSG door and window openings remove real volume and let rays through', () => {
  const geometry = createWallGeometry(5, 2.7, .12, [
    { x: -1.3, width: .9, height: 2.1, sillHeight: 0 },
    { x: 1.1, width: 1.2, height: 1.2, sillHeight: .9 },
  ]);
  try {
    assert.equal(rayHits(geometry, -1.3, 1).length, 0, 'door aperture should be empty');
    assert.equal(rayHits(geometry, -1.3, .001).length, 0, 'door threshold must reach the floor');
    assert.equal(rayHits(geometry, 1.1, 1.4).length, 0, 'window aperture should be empty');
    assert.ok(rayHits(geometry, 1.1, .4).length > 0, 'wall remains under the window');
    assert.ok(rayHits(geometry, -1.3, 2.5).length > 0, 'wall remains above the door');
    assert.ok(rayHits(geometry, 0, 1.4).length > 0, 'wall remains between openings');
    const expected = (5 * 2.7 - .9 * 2.1 - 1.2 * 1.2) * .12;
    assert.ok(Math.abs(Number(computeMeshVolume(geometry)) - expected) < .00001);
    const uv = geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      assert.ok(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)));
      assert.ok(uv.getX(i) >= -.00001 && uv.getX(i) <= 1.00001);
      assert.ok(uv.getY(i) >= -.00001 && uv.getY(i) <= 1.00001);
    }
  } finally { geometry.dispose(); }
});

test('runtime regeneration restores the old opening and cuts the new dimensions', () => {
  const previous = createWallGeometry(5, 2.7, .12, [{ x: -1.2, width: .9, height: 2.1, sillHeight: 0 }]);
  const next = createWallGeometry(5, 3, .12, [{ x: 1.1, width: 1.6, height: 2.3, sillHeight: 0 }]);
  try {
    assert.equal(rayHits(previous, -1.2, 1).length, 0);
    assert.ok(rayHits(next, -1.2, 1, 3).length > 0, 'old opening must close after movement');
    assert.equal(rayHits(next, 1.1, 2.2, 3).length, 0, 'new dimensions must cut the wall');
    assert.ok(rayHits(next, 1.1, 2.8, 3).length > 0, 'height change must preserve lintel');
    const expected = (5 * 3 - 1.6 * 2.3) * .12;
    assert.ok(Math.abs(Number(computeMeshVolume(next)) - expected) < .00001);
  } finally { previous.dispose(); next.dispose(); }
});

test('all four wall transforms preserve a through-opening and solid surrounding wall', () => {
  const room = { width: 5, depth: 4, height: 2.7 };
  for (const wallId of ['north', 'east', 'south', 'west']) {
    const opening = createOpening('window-fixed', wallId, .5);
    const transform = openingWorldTransform(room, opening);
    const length = wallId === 'north' || wallId === 'south' ? room.width : room.depth;
    const geometry = createWallGeometry(length, room.height, .12, [{ x: 0, ...opening }]);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set(transform.x, room.height / 2, transform.z);
    wall.rotation.y = transform.rotation;
    wall.updateMatrixWorld(true);
    const inward = new THREE.Vector3(Math.sin(transform.rotation), 0, Math.cos(transform.rotation));
    const origin = new THREE.Vector3(transform.x, 1.4, transform.z).addScaledVector(inward, 1);
    try {
      assert.equal(new THREE.Raycaster(origin, inward.clone().negate()).intersectObject(wall).length, 0, wallId);
      origin.y = .4;
      assert.ok(new THREE.Raycaster(origin, inward.clone().negate()).intersectObject(wall).length > 0, wallId);
    } finally { geometry.dispose(); material.dispose(); }
  }
});
