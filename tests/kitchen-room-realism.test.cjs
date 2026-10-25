const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { roomWalls } = loadSource('src/lib/kitchenCabinets.ts');
const { roomOutline } = loadSource('src/lib/kitchenRoomOutline.ts');
const { ROOM_WALL_THICKNESS } = loadSource('src/lib/roomRendering.ts');
const { createKitchenWallGeometry, createKitchenFloorGeometry, kitchenWallTransform, kitchenDaylightGeometry, kitchenPaintDesign, KITCHEN_FLOOR_THICKNESS } = loadSource('src/three/kitchenRoomShellGeometry.ts');
const { openingWorldTransform } = loadSource('src/lib/roomOpenings.ts');

const room = { width: 4000, depth: 3000, height: 2600 };
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.00001, `${label}: ${actual} vs ${expected}`);

test('kitchen walls grow 20cm outside all four measured boundaries while windows stay open', () => {
  for (const wall of roomWalls(room)) {
    const centre = { x: (wall.start.x + wall.end.x) / 2, z: (wall.start.z + wall.end.z) / 2 };
    const next = { ...room, items: [{ id: 'window', kind: 'window', wall: wall.id, ...centre, width: 1200, depth: 100 }] };
    const geometry = createKitchenWallGeometry(wall, next);
    const materials = [0, 1].map(() => new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    const mesh = new THREE.Mesh(geometry, materials);
    const transform = kitchenWallTransform(wall, roomWalls(next));
    mesh.position.set(transform.x - wall.inward.x * ROOM_WALL_THICKNESS / 2, room.height / 2000,
      transform.z - wall.inward.z * ROOM_WALL_THICKNESS / 2);
    mesh.rotation.y = transform.rotation;
    mesh.updateMatrixWorld();
    const inward = new THREE.Vector3(wall.inward.x, 0, wall.inward.z);
    const origin = new THREE.Vector3(centre.x / 1000, 1.4, centre.z / 1000).add(inward);
    const ray = new THREE.Raycaster(origin, inward.clone().negate());
    try {
      assert.equal(ray.intersectObject(mesh).length, 0, `${wall.id}: window is a real through-opening`);
      origin.y = 0.4;
      ray.set(origin, inward.clone().negate());
      const hits = ray.intersectObject(mesh);
      close(hits[0].distance, 1, `${wall.id}: interior boundary must not move`);
      close(hits.at(-1).distance, 1 + ROOM_WALL_THICKNESS, `${wall.id}: exterior wall thickness`);
      assert.deepEqual(geometry.groups.map(group => group.materialIndex), [0, 1]);
    } finally { geometry.dispose(); materials.forEach(material => material.dispose()); }
  }
});

test('thick rectangular and curved kitchen walls have matching outer miter corners', () => {
  const outline = roomOutline(room);
  outline[2].curve = { x: 2000, z: 1800 };
  for (const plan of [room, { ...room, outline }]) {
    const walls = roomWalls(plan);
    for (const [index, wall] of walls.entries()) {
      const next = walls[(index + 1) % walls.length];
      const a = kitchenWallTransform(wall, walls), b = kitchenWallTransform(next, walls);
      const corner = (transform, localX) => new THREE.Vector3(localX, 0, -ROOM_WALL_THICKNESS / 2)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), transform.rotation)
        .add(new THREE.Vector3(transform.x, 0, transform.z))
        .add(new THREE.Vector3(-Math.sin(transform.rotation) * ROOM_WALL_THICKNESS / 2, 0, -Math.cos(transform.rotation) * ROOM_WALL_THICKNESS / 2));
      const outerEnd = corner(a, a.length / 2 + a.ends.end);
      const outerStart = corner(b, -b.length / 2 - b.ends.start);
      close(outerEnd.distanceTo(outerStart), 0, `${wall.id}: outer joint`);
    }
  }
});

test('open-front kitchen walls retain their exposed solid end caps', () => {
  const next = { ...room, openFront: true }, walls = roomWalls(next);
  assert.equal(walls.length, 3);
  for (const wall of walls.filter(wall => wall.id === 'right' || wall.id === 'left')) {
    const transform = kitchenWallTransform(wall, walls);
    const start = wall.id === 'left';
    assert.equal(start ? transform.ends.openStart : transform.ends.openEnd, false);
    assert.equal(start ? transform.ends.start : transform.ends.end, 0);
    const geometry = createKitchenWallGeometry(wall, next, walls);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, [material, material]);
    mesh.updateMatrixWorld();
    const direction = start ? 1 : -1;
    const x = -direction * (transform.length / 2 + 0.1);
    try {
      const hits = new THREE.Raycaster(new THREE.Vector3(x, 0, 0), new THREE.Vector3(direction, 0, 0)).intersectObject(mesh);
      close(hits[0].distance, 0.1, `${wall.id}: exposed end is closed`);
    } finally { geometry.dispose(); material.dispose(); }
  }
});

test('rectangular and outlined kitchen floors preserve floor level, dimensions and physical UV scale', () => {
  const outline = roomOutline(room);
  outline[2].curve = { x: 2000, z: 1800 };
  for (const next of [room, { ...room, outline: roomOutline(room) }, { ...room, outline }]) {
    const geometry = createKitchenFloorGeometry(next);
    try {
      close(geometry.boundingBox.max.y, 0, 'finished floor level');
      close(geometry.boundingBox.min.y, -KITCHEN_FLOOR_THICKNESS, 'slab thickness');
      close(geometry.boundingBox.min.x, 0, 'floor starts at original x');
      close(geometry.boundingBox.max.x, room.width / 1000, 'floor retains measured width');
      const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
      for (let index = 0; index < positions.count; index++) {
        close(uv.getX(index), positions.getX(index) / (room.width / 1000), 'normalised floor U');
        close(uv.getY(index), positions.getZ(index) / (room.depth / 1000), 'normalised floor V');
      }
      assert.deepEqual(geometry.groups.map(group => group.materialIndex), [0, 1], 'wood surface and neutral slab edge are separate');
    } finally { geometry.dispose(); }
  }
});

test('kitchen cutaway keeps wall shadows and settles its demand animation', () => {
  const React = require('react');
  const refs = [], frames = [];
  const paintEnvironment = new THREE.Texture();
  let paintCalls = 0;
  const { KitchenRoomShell } = loadSource('src/three/KitchenRoomShell.tsx', {
    react: { ...React, useMemo: create => create(), useEffect() {}, useRef: current => { const ref = { current }; refs.push(ref); return ref; } },
    '@react-three/fiber': { useFrame: frame => frames.push(frame) },
    '@react-three/drei': { RoundedBox: 'rounded-box' },
    './roomMaterials': { useRoomMaterial: () => ({ color: '#eeede7', roughness: .8 }) },
    './RoomDaylightFill': { RoomDaylightFill: 'room-daylight-fill' },
    './useRoomPaintEnvironment': { useRoomPaintEnvironment: () => { paintCalls++; return paintEnvironment; } },
  });
  const shell = KitchenRoomShell({ room });
  const children = React.Children.toArray(shell.props.children);
  const wall = children.find(child => typeof child.type === 'function' && child.props.wall?.id === 'back');
  const wallTree = wall.type(wall.props);
  const wallChildren = React.Children.toArray(wallTree.props.children);
  const wallElement = React.Children.toArray(wallChildren[0].props.children)[0];
  assert.equal(paintCalls, 1, 'one shared paint environment is created for the whole kitchen');
  assert.equal(React.Children.toArray(wallElement.props.children)[0].props.envMap, paintEnvironment);
  assert.ok(wallChildren.some(child => child.type === 'mesh' && React.Children.toArray(child.props.children).some(surface => surface.props.map === wall.props.contactTexture)), 'contact strips stay outside the faded wall subtree');
  const materials = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()];
  const mesh = new THREE.Mesh(wallElement.props.geometry, materials);
  mesh.castShadow = true;
  const root = new THREE.Group();
  root.add(mesh);
  wallChildren[0].props.ref.current = root;
  wallElement.props.ref.current = mesh;
  const frame = frames.at(-1);
  let invalidations = 0;
  const state = { camera: { position: new THREE.Vector3(2, 3, -2) }, invalidate: () => invalidations++ };
  try {
    for (let step = 0; step < 80; step++) frame(state, 1 / 60);
    assert.equal(mesh.castShadow, true);
    assert.equal(materials[0].opacity, 0);
    assert.equal(materials[1].opacity, 0);
    assert.equal(materials[0].colorWrite, false);
    const settled = invalidations;
    frame(state, 1 / 60);
    assert.equal(invalidations, settled, 'settled cutaway must not keep a demand canvas awake');
    state.camera.position.z = 1;
    for (let step = 0; step < 80; step++) frame(state, 1 / 60);
    assert.equal(materials[0].opacity, 1);
    assert.equal(materials[0].transparent, false);
    assert.equal(materials[0].depthWrite, true);
    assert.equal(materials[1].colorWrite, true);
    assert.equal(mesh.castShadow, true);
  } finally {
    wallElement.props.geometry.dispose();
    children[0].props.geometry.dispose();
    wall.props.contactTexture.dispose();
    paintEnvironment.dispose();
    materials.forEach(material => material.dispose());
  }
});

test('shared kitchen daylight windows retain all four wall directions and fixed opening heights', () => {
  for (const wall of roomWalls(room)) {
    const centre = { x: wall.start.x + (wall.end.x - wall.start.x) * .35, z: wall.start.z + (wall.end.z - wall.start.z) * .35 };
    const next = { ...room, items: [{ id: 'window', kind: 'window', wall: wall.id, ...centre, width: 1000, depth: 100 }] };
    const result = kitchenDaylightGeometry(next);
    const opening = result.design.openings[0];
    const transform = openingWorldTransform(result.design, opening);
    close(transform.x + room.width / 2000, centre.x / 1000, `${wall.id}: daylight x`);
    close(transform.z + room.depth / 2000, centre.z / 1000, `${wall.id}: daylight z`);
    close(opening.position, .35, `${wall.id}: clockwise position`);
    close(opening.sillHeight, .9, 'window sill matches wall hole');
    close(opening.height, 1.1, 'window height matches wall hole');
    close(result.rotation, 0, 'rectangular daylight requires no correction');
    close(Math.hypot(...result.offset), 0, 'rectangular daylight stays centred');
  }
});

test('inset kitchen windows keep their real position when using the shared daylight rig', () => {
  const outline = [[0, 0, 'back'], [4000, 0, 'right'], [4000, 3000, 'front'], [2500, 3000, 'right'], [2500, 2000, 'front'], [0, 2000, 'left']]
    .map(([x, z, wall]) => ({ x, z, wall }));
  const next = { ...room, outline, items: [{ id: 'window', kind: 'window', wall: 'front', x: 1000, z: 2000, width: 900, depth: 100 }] };
  const result = kitchenDaylightGeometry(next);
  const expected = openingWorldTransform(result.design, result.design.openings[0]);
  const corrected = new THREE.Vector3(expected.x, 0, expected.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), result.rotation)
    .add(new THREE.Vector3(result.offset[0] + room.width / 2000, 0, result.offset[1] + room.depth / 2000));
  close(corrected.x, 1, 'inset daylight x');
  close(corrected.z, 2, 'inset daylight z');
  const empty = kitchenDaylightGeometry(room);
  assert.equal(empty.design.openings.length, 0, 'rooms without windows retain the shared ceiling-fill fallback');
});

test('kitchen roof casts shadows independently while the visible ceiling follows interior camera height', () => {
  const React = require('react');
  const refs = [], frames = [];
  const { KitchenRoomShell } = loadSource('src/three/KitchenRoomShell.tsx', {
    react: { ...React, useMemo: create => create(), useEffect() {}, useRef: current => { const ref = { current }; refs.push(ref); return ref; } },
    '@react-three/fiber': { useFrame: frame => frames.push(frame) },
    '@react-three/drei': { RoundedBox: 'rounded-box' },
    './roomMaterials': { useRoomMaterial: () => ({ color: '#eeede7', roughness: .8 }) },
    './RoomDaylightFill': { RoomDaylightFill: 'room-daylight-fill' },
    './useRoomPaintEnvironment': { useRoomPaintEnvironment: () => null },
  });
  const shell = KitchenRoomShell({ room, interior: true });
  const children = React.Children.toArray(shell.props.children);
  const roof = children.find(child => child.type === 'mesh' && child.props.castShadow && child.props.userData?.previewRoof);
  const ceiling = children.find(child => child.type === 'mesh' && child.props.visible === false);
  const actual = new THREE.Mesh(); refs[0].current = actual;
  try {
    assert.equal(roof.props.children.props.colorWrite, false);
    assert.equal(roof.props.children.props.depthWrite, false);
    assert.equal(roof.props.castShadow, true);
    close(roof.props.position[1] + roof.props.geometry.boundingBox.min.y, room.height / 1000, 'roof underside aligns to room height');
    assert.equal(ceiling.props.geometry, roof.props.geometry, 'ceiling and roof reuse the measured footprint geometry');
    frames[0]({ camera: { position: { y: 1.6 } } });
    assert.equal(actual.visible, true);
    frames[0]({ camera: { position: { y: 4 } } });
    assert.equal(actual.visible, false);
    const contactTexture = children.find(child => typeof child.type === 'function' && child.props.wall)?.props.contactTexture;
    assert.equal(contactTexture.image.width, 2);
    assert.equal(contactTexture.image.height, 32);
    contactTexture.dispose();
    const orbit = KitchenRoomShell({ room, interior: false });
    const orbitChildren = React.Children.toArray(orbit.props.children);
    const orbitCeiling = new THREE.Mesh(); refs.at(-1).current = orbitCeiling;
    frames.at(-1)({ camera: { position: { y: 1.6 } } });
    assert.equal(orbitCeiling.visible, false, 'orbit view stays unobstructed even below ceiling height');
    orbitChildren[0].props.geometry.dispose();
    orbitChildren.find(child => typeof child.type === 'function' && child.props.wall).props.contactTexture.dispose();
  } finally { children[0].props.geometry.dispose(); }
});

test('kitchen room-aware paint reflections map each saved wall color and share the room defaults', () => {
  const { DEFAULT_KITCHEN_WALL_COLOR } = loadSource('src/lib/kitchenSpace.ts');
  const plan = { ...room, wallColors: { back: '#ece8df', right: '#ced7cd', front: '#b3c3d4', left: '#d8b9ac' },
    items: [{ id: 'window', kind: 'window', wall: 'back', x: 1500, z: 0, width: 1200, depth: 100 }] };
  const design = kitchenPaintDesign(plan);
  assert.deepEqual(Object.fromEntries(Object.entries(design.wallMaterials).map(([wall, finish]) => [wall, finish.color])),
    { north: '#ece8df', east: '#ced7cd', south: '#b3c3d4', west: '#d8b9ac' });
  assert.deepEqual(design.openings, kitchenDaylightGeometry(plan).design.openings);
  assert.equal(design.width, 4); assert.equal(design.depth, 3); assert.equal(design.height, 2.6);
  assert.equal(design.floorMaterial, 'parquet-oak'); assert.equal(design.ceilingMaterial, 'ceiling-white');
  assert.equal(design.lighting.mode, 'day'); assert.equal(design.lighting.timeOfDay, 12);
  assert.deepEqual(design.pieces, []); assert.deepEqual(design.lighting.fixtures, []);
  assert.equal(kitchenPaintDesign(room).wallMaterials.north.color, DEFAULT_KITCHEN_WALL_COLOR);
});
