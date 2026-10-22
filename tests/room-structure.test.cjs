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

test('joined wall miters do not render internal caps but retain their outer shell', () => {
  const length = 5, height = 2.7, thickness = .2;
  const closed = createWallGeometry(length, height, thickness, [], { start: .2, end: .2 });
  const joined = createWallGeometry(length, height, thickness, [], { start: .2, end: .2, openStart: true, openEnd: true });
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const hits = (geometry, sign) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld();
    return new THREE.Raycaster(
      new THREE.Vector3(sign * (length / 2 + thickness), 0, thickness / 2),
      new THREE.Vector3(-sign, 0, -1).normalize(),
    ).intersectObject(mesh);
  };
  try {
    for (const sign of [-1, 1]) {
      const capped = hits(closed, sign), uncapped = hits(joined, sign);
      assert.ok(capped.length > 0 && uncapped.length > 0);
      assert.ok(uncapped[0].distance > capped[0].distance + .1, 'internal diagonal must disappear while the exterior wall remains');
    }
    assert.ok(rayHits(joined, 0, 1.4).length > 0, 'interior wall face remains solid');
  } finally { closed.dispose(); joined.dispose(); material.dispose(); }
});

test('removing joined caps after CSG preserves window jambs and door lintels', () => {
  const geometry = createWallGeometry(5, 2.7, .2, [
    { x: -1.3, width: .9, height: 2.1, sillHeight: 0 },
    { x: 1.1, width: 1.2, height: 1.2, sillHeight: .9 },
  ], { start: .2, end: .2, openStart: true, openEnd: true });
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld();
  try {
    assert.equal(rayHits(geometry, -1.3, 1).length, 0);
    assert.equal(rayHits(geometry, 1.1, 1.4).length, 0);
    assert.ok(rayHits(geometry, -1.3, 2.5).length > 0);
    assert.ok(new THREE.Raycaster(new THREE.Vector3(1.1, 0, 0), new THREE.Vector3(1, 0, 0)).intersectObject(mesh).length > 0, 'window jamb remains');
    assert.ok(new THREE.Raycaster(new THREE.Vector3(-1.3, 0, 0), new THREE.Vector3(0, 1, 0)).intersectObject(mesh).length > 0, 'door lintel remains');
  } finally { geometry.dispose(); material.dispose(); }
});

test('walls use opaque depth writes inside and switch safely during camera fades', () => {
  let frame;
  const { RoomStructure } = loadSource('src/three/RoomStructure.tsx', {
    react: { ...require('react'), useMemo: fn => fn(), useEffect: () => {}, useRef: value => ({ current: value }) },
    '@react-three/fiber': { useFrame: fn => { frame = fn; } },
    './roomMaterials': { useRoomMaterial: () => ({}) },
    './OpeningMesh': { OpeningMesh: () => null },
    './useRoomPaintEnvironment': { useRoomPaintEnvironment: () => null },
  });
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
  const tree = RoomStructure({ design: { width: 5, depth: 4, height: 2.7 }, view: 'perspective' });
  const wallNode = nodes(tree).find(node => node.props?.segment?.nz === 1);
  const rendered = wallNode.type(wallNode.props);
  const wall = nodes(rendered).find(node => node.type === 'mesh' && node.props.geometry);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(wall.props.geometry, material);
  mesh.position.set(0, 1.35, -2.1);
  wall.props.ref.current = mesh;
  const camera = new THREE.PerspectiveCamera();
  const state = { camera, invalidate() {} };
  try {
    camera.position.set(0, 1.5, 0);
    frame(state, 1 / 60);
    assert.equal(material.transparent, false);
    assert.equal(material.depthWrite, true);
    camera.position.z = -3;
    frame(state, 1 / 60);
    assert.equal(material.transparent, true);
    assert.equal(material.depthWrite, false);
    assert.ok(material.opacity < 1);
    assert.equal(mesh.castShadow, true, 'faded walls still block exterior sunlight');
    const version = material.version;
    frame(state, 1 / 60);
    assert.equal(material.version, version, 'shader is not recompiled on every fade frame');
    for (let i = 0; i < 100; i++) frame(state, 1 / 60);
    assert.equal(material.opacity, 0, 'the camera-facing wall disappears completely');
    assert.equal(material.colorWrite, false);
    assert.equal(mesh.castShadow, true);
    camera.position.z = 0;
    frame(state, 1 / 60);
    assert.equal(material.depthWrite, false, 'returning wall remains translucent until settled');
    for (let i = 0; i < 100; i++) frame(state, 1 / 60);
    assert.equal(material.opacity, 1);
    assert.equal(material.transparent, false);
    assert.equal(material.depthWrite, true);
    assert.equal(material.colorWrite, true);
  } finally { mesh.geometry.dispose(); material.dispose(); }
});

test('an inactive room wall fades when it obstructs the selected neighbouring room', () => {
  let frame;
  const { RoomStructure } = loadSource('src/three/RoomStructure.tsx', {
    react: { ...require('react'), useMemo: fn => fn(), useEffect: () => {}, useRef: value => ({ current: value }) },
    '@react-three/fiber': { useFrame: fn => { frame = fn; } },
    './roomMaterials': { useRoomMaterial: () => ({}) },
    './OpeningMesh': { OpeningMesh: () => null },
    './useRoomPaintEnvironment': { useRoomPaintEnvironment: () => null },
  });
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];
  const tree = RoomStructure({ design: { width: 5, depth: 4, height: 2.7 }, view: 'perspective', readOnly: true, wallFocus: [0, 0] });
  const node = nodes(tree).find(node => node.props?.segment?.nz === 1);
  const wall = nodes(node.type(node.props)).find(node => node.type === 'mesh' && node.props.geometry);
  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(wall.props.geometry, material);
  wall.props.ref.current = mesh;
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1.5, 3);
  const state = { camera, invalidate() {} };
  try {
    // The camera is still inside the original room after selecting its neighbour.
    // Its north wall is now between the camera and the selected room's centre.
    mesh.position.set(0, 1.35, 1);
    frame(state, 1 / 60);
    assert.ok(material.opacity < 1, 'the original room wall must not obscure its neighbour');
    assert.equal(material.depthWrite, false);
    assert.equal(mesh.castShadow, true);
    // Other inactive walls beyond the selected room should remain visible.
    mesh.position.z = -1;
    for (let i = 0; i < 100; i++) frame(state, 1 / 60);
    assert.equal(material.opacity, 1);
    assert.equal(material.depthWrite, true);
    mesh.position.set(10, 1.35, 1);
    frame(state, 1 / 60);
    assert.equal(material.opacity, 1, 'an off-axis wall must not fade just because its plane crosses the view');
  } finally { mesh.geometry.dispose(); material.dispose(); }
});

test('partial room connections have one visible surface at the neighbour ends in every direction', () => {
  const { getRoomGeometry } = loadSource('src/lib/roomGeometry.ts');
  const { wallMiterEnds, wallOpenEnds, ROOM_WALL_THICKNESS } = loadSource('src/lib/roomRendering.ts');
  const layout = loadSource('src/lib/roomLayout.ts');
  const a = { id: 'a', width: 4, depth: 4, height: 2.7, position: { x: 0, z: 0 } };
  const cases = [
    { width: 4, depth: 2, position: { x: 4, z: 1 }, origin: [1, 1.13, -.073], direction: [1, 0, 0], passage: [1, 1.13, 1] },
    { width: 4, depth: 2, position: { x: -4, z: 1 }, origin: [-1, 1.13, -.073], direction: [-1, 0, 0], passage: [-1, 1.13, 1] },
    { width: 2, depth: 4, position: { x: 1, z: -4 }, origin: [-.073, 1.13, -1], direction: [0, 0, -1], passage: [1, 1.13, -1] },
    { width: 2, depth: 4, position: { x: 1, z: 4 }, origin: [-.073, 1.13, 1], direction: [0, 0, 1], passage: [1, 1.13, 1] },
  ];
  for (const example of cases) for (const kind of ['open', 'door']) {
  const b = { id: 'b', height: 2.7, ...example };
  const rooms = [a, b];
  const connection = { ...layout.defaultConnection(layout.roomContacts(a, b)[0], rooms), kind };
  const walls = [];
  const material = new THREE.MeshBasicMaterial();
  try {
    for (const room of rooms) {
      const segments = getRoomGeometry(room).segments;
      const shared = layout.connectionGeometry(room, rooms, [connection]);
      for (const segment of segments) {
        const ends = wallMiterEnds(room, segment, segments, shared.boundaries);
        const open = wallOpenEnds(room, segment, segments, shared.boundaries);
        const geometry = createWallGeometry(segment.length, room.height, ROOM_WALL_THICKNESS,
          layout.sharedCutsForSegment(room, segment, shared.cuts), { ...ends, ...open });
        const mesh = new THREE.Mesh(geometry, material);
        const rotation = -Math.atan2(segment.b.z - segment.a.z, segment.b.x - segment.a.x);
        mesh.rotation.y = rotation;
        mesh.position.set((segment.a.x + segment.b.x) / 2 + room.position.x,
          room.height / 2, (segment.a.z + segment.b.z) / 2 + room.position.z);
        mesh.translateZ(-ROOM_WALL_THICKNESS / 2);
        mesh.updateMatrixWorld();
        walls.push(mesh);
      }
    }
    const direction = new THREE.Vector3(...example.direction);
    const hits = new THREE.Raycaster(new THREE.Vector3(...example.origin), direction).intersectObjects(walls);
    const seam = hits.filter(hit => Math.abs(hit.distance - 1) < .00001);
    assert.equal(new Set(seam.map(hit => hit.object)).size, 1,
      'the remaining main-room wall and neighbour end cap must not occupy the same plane');
    assert.equal(new THREE.Raycaster(new THREE.Vector3(...example.passage), direction).intersectObjects(walls).filter(hit => hit.distance < 2).length, 0,
      'the connected passage stays clear');
  } finally { walls.forEach(mesh => mesh.geometry.dispose()); material.dispose(); }
  }
});

test('a shared end retains its exposed cap above a shorter neighbouring room', () => {
  const { getRoomGeometry } = loadSource('src/lib/roomGeometry.ts');
  const { wallMiterEnds, wallOpenEnds } = loadSource('src/lib/roomRendering.ts');
  const layout = loadSource('src/lib/roomLayout.ts');
  const a = { id: 'a', width: 4, depth: 4, height: 2.7, position: { x: 0, z: 0 } };
  const b = { id: 'b', width: 4, depth: 2, height: 3.2, position: { x: 4, z: 1 } };
  const rooms = [a, b];
  const c = { ...layout.defaultConnection(layout.roomContacts(a, b)[0], rooms), kind: 'open' };
  const shared = layout.connectionGeometry(b, rooms, [c]);
  const segments = getRoomGeometry(b).segments;
  const north = segments.find(segment => segment.nz === 1);
  const ends = { ...wallMiterEnds(b, north, segments, shared.boundaries), ...wallOpenEnds(b, north, segments, shared.boundaries) };
  assert.equal(ends.openStart, a.height);
  const geometry = createWallGeometry(north.length, b.height, .2, [], ends);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld();
  const hits = y => new THREE.Raycaster(new THREE.Vector3(-3, y - b.height / 2, -.073), new THREE.Vector3(1, 0, 0)).intersectObject(mesh);
  try {
    assert.equal(hits(1.13).length, 0, 'covered cap disappears below the common ceiling');
    assert.ok(hits(2.9).length > 0, 'the exposed upper wall end stays closed');
    for (const name of ['position', 'normal', 'uv'])
      assert.ok(Array.from(geometry.getAttribute(name).array).every(Number.isFinite));
  } finally { geometry.dispose(); material.dispose(); }
});
