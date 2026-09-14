const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const React = require('react');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { createCabinet } = loadSource('src/lib/kitchenCabinets.ts');
const { getComponents, getComponentSize, replaceComponent, withOpening } = loadSource('src/lib/kitchenComponents.ts');
const { applyKitchenAppearance, kitchenEnvelope, parseKitchen } = loadSource('src/lib/kitchenAssembly.ts');
const { snapshotKitchen } = loadSource('src/three/kitchenExport.ts');
const schema = new (require('ajv'))({ allErrors: true }).compile(JSON.parse(readFileSync('src/lib/cabinet.schema.json', 'utf8')));
const near = (actual, expected, message = '') => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} != ${expected}`);
const part = (cabinet, type) => getComponents(cabinet).find(item => item.type === type);
function cabinet(opening = 'doors', patch = {}) {
  const c = withOpening(createCabinet('base', 'parts'), opening);
  return { ...c, position: { x: 1500, z: 1500, y: 0, rotation: 0 }, ...patch };
}
const kitchen = cabinets => ({ version: 1, room: { width: 4000, depth: 4000, height: 3000 }, cabinets,
  wallClearance: 550, countertop: { thickness: 30, frontOverhang: 20, material: 'laminate', finish: 'marble' }, backsplash: false });
function replace(design, item, id = design.cabinets[0].id) {
  const result = replaceComponent(design, id, item);
  assert.equal(result.error, undefined);
  return result.kitchen;
}

// Evaluate the actual shared React renderer with real Three geometries, materials,
// and procedural textures. WebGL and a browser are unnecessary for these checks.
const { KitchenAssemblyMesh } = loadSource('src/three/KitchenAssemblyMesh.tsx', {
  react: { ...React, useMemo: fn => fn(), useEffect: () => {} },
});
function scene(node, parent = new THREE.Group()) {
  for (const element of React.Children.toArray(node)) {
    if (!React.isValidElement(element)) continue;
    if (typeof element.type === 'function') { scene(element.type(element.props), parent); continue; }
    if (typeof element.type === 'symbol') { scene(element.props.children, parent); continue; }
    const Geometry = { boxGeometry: THREE.BoxGeometry, sphereGeometry: THREE.SphereGeometry,
      ringGeometry: THREE.RingGeometry, extrudeGeometry: THREE.ExtrudeGeometry,
      cylinderGeometry: THREE.CylinderGeometry, torusGeometry: THREE.TorusGeometry }[element.type];
    if (Geometry) { parent.geometry.dispose(); parent.geometry = new Geometry(...element.props.args); continue; }
    if (element.type === 'meshStandardMaterial') {
      parent.material.dispose();
      const props = Object.fromEntries(Object.entries(element.props).filter(([key, value]) => key !== 'children' && value !== undefined));
      parent.material = new THREE.MeshStandardMaterial(props); continue;
    }
    if (!['mesh', 'group'].includes(element.type)) continue;
    const object = element.type === 'mesh' ? new THREE.Mesh() : new THREE.Group();
    if (element.props.position) object.position.fromArray(element.props.position);
    if (element.props.rotation) object.rotation.fromArray(element.props.rotation);
    if (element.props.scale) object.scale.fromArray(element.props.scale);
    if (element.props.name) object.name = element.props.name;
    if (element.props.userData) object.userData = { ...element.props.userData };
    parent.add(object); scene(element.props.children, object);
  }
  return parent;
}
function render(design) {
  const root = scene(React.createElement(KitchenAssemblyMesh, { kitchen: design }));
  root.updateMatrixWorld(true); return root;
}
function meshes(root) { const result = []; root.traverse(node => { if (node.isMesh) result.push(node); }); return result; }
function dispose(root) {
  const textures = new Set();
  root.traverse(node => {
    node.geometry?.dispose();
    for (const material of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) {
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      material.dispose();
    }
  });
  textures.forEach(texture => texture.dispose());
}
function localBounds(root) {
  const inverse = root.matrixWorld.clone().invert(), box = new THREE.Box3();
  for (const mesh of meshes(root)) box.union(new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position)
    .applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)));
  return box;
}

test('door and drawer finishes change independently without recoloring the cabinet sides', () => {
  const c = cabinet('doors', { drawerCount: 1 }), original = kitchen([c]);
  const before = JSON.stringify(original), originalScene = render(original);
  let changed = replace(original, { type: 'door-front', model: 'shaker', color: '#ca7050', finish: 'walnut' });
  changed = replace(changed, { type: 'drawer-front', model: 'flat', color: '#2b756b', finish: 'gloss' });
  const root = render(changed);
  try {
    assert.equal(JSON.stringify(original), before);
    assert.equal(changed.cabinets[0].color, c.color);
    assert.equal(changed.cabinets[0].material, c.material);
    assert.equal(changed.cabinets[0].frontStyle, c.frontStyle);
    assert.equal(part(changed.cabinets[0], 'door-front').model, 'shaker');
    assert.equal(part(changed.cabinets[0], 'drawer-front').model, 'flat');
    const door = root.getObjectByName(`Component-door-front-${c.id}`), drawer = root.getObjectByName(`Component-drawer-front-${c.id}`);
    assert.equal(door.children[0].material.color.getHexString(), 'ca7050');
    assert.ok(door.children[0].material.map?.isDataTexture);
    assert.equal(drawer.children[0].material.color.getHexString(), '2b756b');
    assert.equal(drawer.children[0].material.map, null, 'gloss drawer must not inherit the oak carcass texture');
    assert.ok(drawer.children[0].material.roughness < door.children[0].material.roughness);
    const sides = tree => meshes(tree.getObjectByName(`Cabinet-${c.id}`)).filter(mesh =>
      mesh.geometry.type === 'BoxGeometry' && Math.abs(mesh.geometry.parameters.width - .018) < 1e-9 &&
      Math.abs(mesh.geometry.parameters.depth - c.depth / 1000) < 1e-9);
    const originalSides = sides(originalScene), currentSides = sides(root);
    assert.equal(currentSides.length, 2);
    currentSides.forEach((mesh, index) => {
      assert.equal(mesh.material.color.getHexString(), originalSides[index].material.color.getHexString());
      assert.deepEqual(mesh.material.map.image.data, originalSides[index].material.map.image.data);
    });
  } finally { dispose(root); dispose(originalScene); }
});

test('explicit global appearance updates both fronts while preserving unrelated component settings', () => {
  const c = cabinet('doors', { drawerCount: 1 }), neighbor = cabinet('doors', { id: 'neighbor', position: { x: 2300, z: 1500, y: 0, rotation: 0 } });
  let original = kitchen([c, neighbor]);
  for (const item of [
    { type: 'door-front', model: 'shaker', finish: 'walnut', color: '#aa4422' },
    { type: 'drawer-front', model: 'glass', finish: 'gloss', color: '#227744' },
    { type: 'frame', model: 'standard', finish: 'oak', color: '#d4c1a2' },
    { type: 'handle', model: 'bar', finish: 'brass', size: { width: 180 } },
  ]) original = replace(original, item);
  const before = JSON.stringify(original);
  const next = applyKitchenAppearance(original, [c.id], { frontStyle: 'flat', finish: 'matte', color: '#f4f1ed', handleStyle: 'knob' });
  for (const type of ['door-front', 'drawer-front']) {
    assert.equal(part(next.cabinets[0], type).model, 'flat');
    assert.equal(part(next.cabinets[0], type).finish, 'matte');
    assert.equal(part(next.cabinets[0], type).color, '#f4f1ed');
  }
  assert.deepEqual(part(next.cabinets[0], 'frame'), part(original.cabinets[0], 'frame'));
  assert.equal(part(next.cabinets[0], 'handle').model, 'knob');
  assert.equal(part(next.cabinets[0], 'handle').size, undefined);
  assert.deepEqual(next.cabinets[1], neighbor);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(parseKitchen(JSON.parse(JSON.stringify(next))), JSON.parse(JSON.stringify(next)));
});

test('component materials and editable dimensions survive schema validation and JSON storage', () => {
  let design = kitchen([cabinet('sink')]);
  for (const item of [
    { type: 'sink', model: 'double', finish: 'ceramic', color: '#e9e2d4', size: { width: 500, depth: 380, height: 190 } },
    { type: 'tap', model: 'angled', finish: 'brass', size: { height: 330, depth: 190 } },
    { type: 'handle', model: 'bar', finish: 'matte-metal', size: { width: 200 } },
    { type: 'door-front', model: 'shaker', finish: 'walnut' },
    { type: 'plinth', model: 'legs', finish: 'matte', color: '#393e38' },
  ]) design = replace(design, item);
  assert.equal(schema(design.cabinets[0]), true, JSON.stringify(schema.errors));
  assert.deepEqual(parseKitchen(JSON.parse(JSON.stringify(design))), design);
  assert.deepEqual(getComponentSize(design.cabinets[0], part(design.cabinets[0], 'sink')), { width: 500, depth: 380, height: 190 });
});

test('invalid materials and dimensions reject atomically and cannot enter a saved design', () => {
  const original = kitchen([cabinet('sink')]), before = JSON.stringify(original);
  for (const item of [
    { type: 'sink', model: 'single', size: { width: 521 } },
    { type: 'sink', model: 'single', size: { depth: 401 } },
    { type: 'sink', model: 'single', size: { height: 119 } },
    { type: 'sink', model: 'single', size: { width: 440.5 } },
    { type: 'sink', model: 'single', size: { rotation: 30 } },
    { type: 'sink', model: 'single', finish: 'walnut' },
    { type: 'tap', model: 'square', finish: 'ceramic' },
    { type: 'tap', model: 'square', size: { height: 351 } },
    { type: 'handle', model: 'bar', size: { width: 250 } },
    { type: 'frame', model: 'standard', size: { width: 700 } },
  ]) {
    const result = replaceComponent(original, original.cabinets[0].id, item);
    assert.equal(typeof result.error, 'string', JSON.stringify(item));
    assert.strictEqual(result.kitchen, original);
    assert.equal(JSON.stringify(original), before);
    const invalid = { ...original, cabinets: [{ ...original.cabinets[0], components: [item] }] };
    assert.throws(() => parseKitchen(invalid), undefined, JSON.stringify(item));
  }
});

test('single and double sink replacements preserve the custom mount dimensions and material', () => {
  let design = replace(kitchen([cabinet('sink')]), { type: 'sink', model: 'single', finish: 'granite', color: '#4d5a52', size: { width: 490, depth: 370, height: 180 } });
  const original = design, initial = part(design.cabinets[0], 'sink');
  for (const model of ['double', 'single']) {
    design = replace(design, { type: 'sink', model });
    assert.deepEqual(part(design.cabinets[0], 'sink'), { ...initial, model });
    assert.deepEqual(design.cabinets[0].position, original.cabinets[0].position);
    const root = render(design);
    try {
      const sink = root.getObjectByName(`Component-sink-${design.cabinets[0].id}`);
      assert.equal(meshes(sink).length, model === 'double' ? 6 : 5);
      for (const mesh of meshes(sink)) {
        assert.equal(mesh.material.color.getHexString(), '4d5a52');
        near(mesh.material.metalness, 0);
        assert.ok(mesh.material.roughness > .8);
      }
    } finally { dispose(root); }
  }
  assert.equal(part(original.cabinets[0], 'sink').model, 'single');
});

test('custom sink geometry and countertop cutouts agree at different sizes and rotations', () => {
  for (const width of [320, 440, 520]) for (const depth of [260, 340, 400]) for (const rotation of [0, Math.PI / 2, -.47]) {
    const c = cabinet('sink', { position: { x: 1500, z: 1500, y: 0, rotation } });
    const design = replace(kitchen([c]), { type: 'sink', model: 'double', size: { width, depth, height: 200 } });
    const root = render(design);
    try {
      const sink = root.getObjectByName(`Component-sink-${c.id}`), box = localBounds(sink);
      near(box.max.x - box.min.x, width / 1000, 'sink width');
      near(box.max.z - box.min.z, depth / 1000, 'sink depth');
      near(box.max.y, 0, 'sink meets worktop surface');
      const inverse = sink.matrixWorld.clone().invert();
      const opening = new THREE.Box3(new THREE.Vector3(-width / 2000 + .001, -.029, -depth / 2000 + .001),
        new THREE.Vector3(width / 2000 - .001, -.001, depth / 2000 - .001));
      const slabs = meshes(root).filter(mesh => mesh.geometry.type === 'ExtrudeGeometry');
      assert.equal(slabs.length, 1);
      for (const slab of slabs) {
        const matrix = new THREE.Matrix4().multiplyMatrices(inverse, slab.matrixWorld), positions = slab.geometry.attributes.position, indices = slab.geometry.index;
        for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
          const points = [0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset).applyMatrix4(matrix));
          assert.equal(opening.intersectsTriangle(new THREE.Triangle(...points)), false, `countertop crosses ${width}×${depth} sink at yaw ${rotation}`);
        }
        // Test the actual extrusion shape as well: a permanently oversized hole would
        // avoid intersections but still leave a visible gap around a smaller sink.
        const points = slab.geometry.parameters.shapes.holes[0].getPoints();
        const holeWidth = Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x));
        const holeDepth = Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y));
        near(holeWidth, width / 1000); near(holeDepth, depth / 1000);
      }
    } finally { dispose(root); }
  }
});

test('custom faucet heights update both visible geometry and the room placement envelope', () => {
  for (const height of [180, 260, 350]) for (const model of ['square', 'angled']) {
    const design = replace(kitchen([cabinet('sink')]), { type: 'tap', model, finish: 'brass', size: { height, depth: 190 } });
    const c = design.cabinets[0], root = render(design);
    try {
      const faucet = root.getObjectByName(`Component-tap-${c.id}`), box = localBounds(faucet);
      near(box.max.y, height / 1000); near(box.min.y, 0);
      const actual = new THREE.Box3().setFromObject(root);
      near(kitchenEnvelope(design).h, (c.height + design.countertop.thickness + height) / 1000);
      near(actual.max.y, kitchenEnvelope(design).h);
      for (const mesh of meshes(faucet)) {
        near(mesh.material.metalness, .85);
        assert.equal(mesh.material.color.getHexString(), 'b29a61');
      }
    } finally { dispose(root); }
  }
});

test('custom bar widths and exposed legs are physical geometry, including in export snapshots', () => {
  const c = cabinet('doors', { drawerCount: 1 });
  let design = replace(kitchen([c]), { type: 'handle', model: 'bar', size: { width: 210 }, finish: 'brass' });
  const recessed = render(design);
  design = replace(design, { type: 'plinth', model: 'legs', color: '#424941', finish: 'matte' });
  const root = render(design); root.userData.kitchenExport = true;
  const room = new THREE.Group(), floor = new THREE.Mesh(new THREE.BoxGeometry(4, .1, 4));
  floor.name = 'Room-floor'; room.add(root, floor);
  const snapshot = snapshotKitchen(root);
  try {
    assert.equal(meshes(recessed.getObjectByName(`Component-plinth-${c.id}`)).length, 1);
    for (const tree of [root, snapshot.scene]) {
      const feet = meshes(tree.getObjectByName(`Component-plinth-${c.id}`));
      assert.equal(feet.length, 4);
      for (const foot of feet) {
        near(foot.geometry.parameters.width, .03); near(foot.geometry.parameters.height, .08); near(foot.geometry.parameters.depth, .03);
        assert.equal(foot.material.color.getHexString(), '424941');
      }
      const bars = meshes(tree).filter(mesh => mesh.geometry.type === 'BoxGeometry' &&
        Math.abs(mesh.geometry.parameters.height - .014) < 1e-9 && Math.abs(mesh.geometry.parameters.depth - .022) < 1e-9);
      assert.equal(bars.length, 3, 'two doors and one drawer retain their handles');
      for (const bar of bars) { near(bar.geometry.parameters.width, .21); near(bar.material.metalness, .85); }
    }
    assert.equal(snapshot.scene.getObjectByName('Room-floor'), undefined);
    const sourceLeg = meshes(root.getObjectByName(`Component-plinth-${c.id}`))[0];
    const exportedLeg = meshes(snapshot.scene.getObjectByName(`Component-plinth-${c.id}`))[0];
    assert.notStrictEqual(sourceLeg.geometry, exportedLeg.geometry);
    assert.notStrictEqual(sourceLeg.material, exportedLeg.material);
    sourceLeg.material.color.set('#ffffff');
    assert.equal(exportedLeg.material.color.getHexString(), '424941', 'export remains stable while the editor changes');
  } finally { snapshot.dispose(); dispose(room); dispose(recessed); }
});
