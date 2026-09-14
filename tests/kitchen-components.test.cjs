const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const React = require('react');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { createCabinet, validateCabinet } = loadSource('src/lib/kitchenCabinets.ts');
const { parseKitchen, kitchenEnvelope, applyKitchenAppearance } = loadSource('src/lib/kitchenAssembly.ts');
const { componentTypes, compatibleOptions, getComponents, replaceComponent, snapAppliance, withOpening } = loadSource('src/lib/kitchenComponents.ts');
const { ovenSlot, OVEN_BODY } = loadSource('src/lib/kitchenAppliances.ts');
const { fitCountertops } = loadSource('src/lib/kitchenPlacement.ts');
const schema = new (require('ajv'))({ allErrors: true }).compile(JSON.parse(readFileSync('src/lib/cabinet.schema.json', 'utf8')));
const near = (a, b, message = '') => assert.ok(Math.abs(a - b) < 0.000001, `${message}: ${a} != ${b}`);

function cabinet(type = 'base', opening = 'oven', patch = {}) {
  const c = withOpening(createCabinet(type, `${type}-${opening}`), opening);
  c.position = { ...c.position, x: 1500, z: 1500 };
  return { ...c, ...patch };
}
const kitchen = cabinets => ({ version: 1, room: { width: 4000, depth: 4000, height: 3500 }, cabinets,
  wallClearance: 550, countertop: { thickness: 30, frontOverhang: 20, material: 'laminate', finish: 'marble' }, backsplash: false });

test('base and tall oven openings agree between schema, validation and persisted JSON', () => {
  for (const type of ['base', 'tall']) for (const depth of [580, 600, 650]) {
    const c = cabinet(type, 'oven', { depth });
    assert.equal(schema(c), true, JSON.stringify(schema.errors));
    assert.equal(validateCabinet(c), null);
    const design = kitchen([c]);
    assert.deepEqual(parseKitchen(JSON.parse(JSON.stringify(design))), design);
  }
  // Previously saved hob-only designs remain valid and do not acquire an oven implicitly.
  const legacy = cabinet('base', 'hob');
  assert.equal(schema(legacy), true);
  assert.equal(validateCabinet(legacy), null);
  assert.deepEqual(parseKitchen(kitchen([legacy])).cabinets[0], legacy);
  assert.equal(getComponents(legacy).some(item => item.type === 'oven'), false);
});

test('invalid oven openings and sizes reject consistently before reaching the renderer', () => {
  const invalid = [
    cabinet('base', 'oven', { width: 400, doorCount: 1 }),
    cabinet('base', 'oven', { width: 800 }),
    cabinet('base', 'oven', { depth: 579 }),
    cabinet('base', 'oven', { drawerCount: 1 }),
    cabinet('wall', 'oven', { width: 600 }),
    cabinet('tall', 'hob'), cabinet('wall', 'sink'),
    cabinet('base', 'free-standing-oven'),
  ];
  for (const c of invalid) {
    const label = `${c.type}/${c.opening}/${c.width}/${c.depth}/${c.drawerCount}`;
    assert.equal(schema(c), false, `schema accepted ${label}`);
    assert.equal(typeof validateCabinet(c), 'string', `validator accepted ${label}`);
    assert.throws(() => parseKitchen(kitchen([c])), undefined, `saved JSON accepted ${label}`);
  }
});

test('component categories follow cabinet openings and replacement choices match the mount size', () => {
  assert.deepEqual(componentTypes(cabinet('base', 'sink')), ['sink', 'tap', 'door-front', 'handle', 'worktop', 'plinth', 'frame']);
  assert.deepEqual(componentTypes(cabinet()), ['oven', 'cooktop', 'worktop', 'plinth', 'frame']);
  assert.deepEqual(componentTypes(cabinet('tall')), ['oven', 'door-front', 'handle', 'frame']);
  assert.deepEqual(componentTypes(cabinet('base', 'drawers')), ['drawer-front', 'handle', 'worktop', 'plinth', 'frame']);
  assert.deepEqual(componentTypes(cabinet('wall', 'open')), ['frame']);
  assert.deepEqual(compatibleOptions(cabinet('base', 'sink'), 'oven'), []);
  assert.deepEqual(compatibleOptions(cabinet('base', 'oven', { width: 800 }), 'oven'), []);
  assert.deepEqual(compatibleOptions(cabinet('base', 'oven', { depth: 570 }), 'oven'), []);
  assert.equal(compatibleOptions(cabinet(), 'oven').length, 2);
  const sink = cabinet('base', 'sink', { components: [{ type: 'sink', model: 'double' }, { type: 'tap', model: 'angled' }, { type: 'frame', model: 'standard', color: '#eeeeee' }] });
  const oven = withOpening(sink, 'oven');
  assert.deepEqual(oven.components, [{ type: 'frame', model: 'standard', color: '#eeeeee' }]);
  assert.equal(oven.drawerCount, 0);
  assert.equal(sink.components.length, 3);
});

test('component replacements preserve the authored design through JSON and split only differing worktop surfaces', () => {
  const first = cabinet('base', 'sink'), second = cabinet('base', 'doors', { id: 'next' });
  second.position = { ...first.position, x: first.position.x + first.width };
  const original = kitchen([first, second]), before = JSON.stringify(original);
  assert.equal(fitCountertops(original).length, 1);
  let current = original;
  for (const item of [{ type: 'sink', model: 'double', color: '#93a5a0', finish: 'steel' }, { type: 'tap', model: 'angled' },
    { type: 'frame', model: 'standard', color: '#dcded6' }, { type: 'door-front', model: 'shaker', color: '#b7bda3' },
    { type: 'handle', model: 'knob' }, { type: 'worktop', model: 'walnut', color: '#69513d' }]) {
    const result = replaceComponent(current, first.id, item);
    assert.equal(result.error, undefined);
    current = result.kitchen;
  }
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(current.cabinets[0].position, first.position);
  assert.equal(current.cabinets[0].id, first.id);
  assert.deepEqual(parseKitchen(JSON.parse(JSON.stringify(current))), current);
  assert.equal(schema(current.cabinets[0]), true, JSON.stringify(schema.errors));
  assert.deepEqual(getComponents(current.cabinets[0], current).find(item => item.type === 'sink'), { type: 'sink', model: 'double', color: '#93a5a0', finish: 'steel' });
  const tops = fitCountertops(current);
  assert.equal(tops.length, 2);
  assert.equal(tops.find(top => top.cabinetIds.includes(first.id)).finish, 'walnut');
  assert.equal(tops.find(top => top.cabinetIds.includes(first.id)).color, '#69513d');
  assert.equal(tops.find(top => top.cabinetIds.includes(second.id)).finish, 'marble');
  const globallyStyled = applyKitchenAppearance(current, null, { handleStyle: 'bar', frontStyle: 'flat', color: '#ffffff' });
  const appearance = getComponents(globallyStyled.cabinets[0], globallyStyled);
  assert.equal(appearance.find(item => item.type === 'handle').model, 'bar');
  assert.equal(appearance.find(item => item.type === 'door-front').model, 'flat');
});

test('appliance snap refuses unsupported targets or collision and preserves the exact original object', () => {
  const ordinary = kitchen([cabinet('base', 'doors')]);
  const tooWide = kitchen([cabinet('base', 'oven', { width: 800 })]);
  const tooShallow = kitchen([cabinet('base', 'oven', { depth: 570 })]);
  const oven = cabinet(), overlapping = cabinet('base', 'doors');
  const collision = kitchen([oven, overlapping]);
  for (const [design, id, item] of [
    [ordinary, ordinary.cabinets[0].id, { type: 'oven', model: 'black' }],
    [tooWide, tooWide.cabinets[0].id, { type: 'oven', model: 'black' }],
    [tooShallow, tooShallow.cabinets[0].id, { type: 'oven', model: 'black' }],
    [collision, oven.id, { type: 'oven', model: 'steel' }],
    [kitchen([oven]), 'missing', { type: 'oven', model: 'black' }],
    [kitchen([oven]), oven.id, { type: 'oven', model: 'black', color: 'red' }],
  ]) {
    const before = JSON.stringify(design), result = snapAppliance(design, id, item);
    assert.equal(typeof result.error, 'string');
    assert.strictEqual(result.kitchen, design);
    assert.equal(JSON.stringify(design), before);
  }
  const valid = kitchen([oven]);
  const installed = snapAppliance(valid, oven.id, { type: 'oven', model: 'steel' });
  assert.equal(installed.error, undefined);
  assert.notStrictEqual(installed.kitchen, valid);
  assert.deepEqual(installed.kitchen.cabinets[0].position, oven.position);
  assert.deepEqual(parseKitchen(installed.kitchen), installed.kitchen);
});

test('saved component data rejects invalid categories, duplicate entries, incompatible products and unsafe colors', () => {
  for (const components of [null, {}, [{ type: 'oven', model: 'black' }, { type: 'oven', model: 'steel' }],
    [{ type: 'sink', model: 'single' }], [{ type: 'oven', model: 'unknown-model' }],
    [{ type: 'oven', model: 'steel', color: 'url(https://example.com)' }],
    [{ type: 'script', model: 'black' }], Array(11).fill({ type: 'frame', model: 'standard' })]) {
    assert.throws(() => parseKitchen(kitchen([cabinet('base', 'oven', { components })])));
  }
  const parsed = parseKitchen(kitchen([cabinet('base', 'oven', { components: [{ type: 'oven', model: 'black', position: { x: 999999 }, secret: 'ignored' }] })]));
  assert.deepEqual(parsed.cabinets[0].components, [{ type: 'oven', model: 'black' }]);
});

// Resolve the actual React mesh tree into Three objects; use real geometry, without WebGL.
const { KitchenAssemblyMesh } = loadSource('src/three/KitchenAssemblyMesh.tsx', {
  react: { ...React, useMemo: fn => fn(), useEffect: () => {} },
  './kitchenTextures': { createKitchenTexture: () => null },
});
function scene(node, parent = new THREE.Group()) {
  for (const element of React.Children.toArray(node)) {
    if (!React.isValidElement(element)) continue;
    if (typeof element.type === 'function') { scene(element.type(element.props), parent); continue; }
    if (typeof element.type === 'symbol') { scene(element.props.children, parent); continue; }
    const Geometry = { boxGeometry: THREE.BoxGeometry, sphereGeometry: THREE.SphereGeometry, ringGeometry: THREE.RingGeometry,
      extrudeGeometry: THREE.ExtrudeGeometry, cylinderGeometry: THREE.CylinderGeometry, torusGeometry: THREE.TorusGeometry }[element.type];
    if (Geometry) { parent.geometry = new Geometry(...element.props.args); continue; }
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
function render(design, centered = false) {
  const root = scene(React.createElement(KitchenAssemblyMesh, { kitchen: design, centered }));
  root.updateMatrixWorld(true);
  return root;
}
const dispose = root => root.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); });
function boundsIn(mesh, inverse) {
  return new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position)
    .applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld));
}
function penetrates(a, b) {
  return ['x', 'y', 'z'].every(axis => Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]) > 0.000001);
}
function belongsTo(node, ancestor) { for (let current = node; current; current = current.parent) if (current === ancestor) return true; return false; }

test('oven meshes fit base and tall slots without carcass shelves or cabinet leaves in the opening, including rotations', () => {
  for (const type of ['base', 'tall']) for (const depth of [580, 600, 650]) for (const rotation of [0, Math.PI / 2, -Math.PI / 2, .37]) {
    const c = cabinet(type, 'oven', { depth }); c.position.rotation = rotation;
    const root = render(kitchen([c]));
    try {
      const oven = root.getObjectByName(`Appliance-oven-${c.id}`);
      assert.ok(oven, 'oven must be its own named appliance');
      assert.deepEqual(oven.userData, { appliance: 'oven', cabinetId: c.id });
      const slot = ovenSlot(c), body = oven.children.find(node => node.isMesh && Math.abs(node.geometry.parameters.width - OVEN_BODY.width / 1000) < 1e-9);
      assert.ok(body, 'physical oven body is present');
      const inverse = oven.matrixWorld.clone().invert(), bodyBox = boundsIn(body, inverse);
      near(bodyBox.max.x - bodyBox.min.x, OVEN_BODY.width / 1000);
      near(bodyBox.max.y - bodyBox.min.y, OVEN_BODY.height / 1000);
      near(bodyBox.max.z - bodyBox.min.z, OVEN_BODY.depth / 1000);
      assert.ok(bodyBox.min.x >= -(c.width - 36) / 2000 - 1e-6);
      assert.ok(bodyBox.max.x <= (c.width - 36) / 2000 + 1e-6);
      assert.ok(bodyBox.min.z >= -c.depth / 2000 + .018);
      assert.ok(bodyBox.min.y > slot.bottom / 1000);
      assert.ok(bodyBox.max.y < slot.top / 1000);
      const frontSlot = new THREE.Box3(new THREE.Vector3(-.28, (slot.bottom + 2) / 1000, c.depth / 2000 - .018),
        new THREE.Vector3(.28, (slot.top - 2) / 1000, c.depth / 2000 + .002));
      root.traverse(mesh => {
        if (!mesh.isMesh || belongsTo(mesh, oven)) return;
        const box = boundsIn(mesh, inverse);
        assert.equal(penetrates(bodyBox, box), false, `carcass intersects ${type} oven body at rotation ${rotation}`);
        if (mesh.geometry.type === 'BoxGeometry' && mesh.geometry.parameters.width > .3 && mesh.geometry.parameters.depth <= .0181)
          assert.equal(penetrates(frontSlot, box), false, 'a cabinet door or filler covers the oven slot');
      });
    } finally { dispose(root); }
  }
});

test('built-in cooktop aligns above the oven and its body occupies the actual countertop cutout', () => {
  for (const rotation of [0, Math.PI / 2, -.4]) {
    const c = cabinet(); c.position.rotation = rotation;
    const root = render(kitchen([c]));
    try {
      const oven = root.getObjectByName(`Appliance-oven-${c.id}`), tops = [];
      root.traverse(node => { if (node.name === `Appliance-cooktop-${c.id}`) tops.push(node); });
      assert.equal(tops.length, 1, 'only the actual cooktop has its appliance name');
      const hob = tops[0], ovenBody = oven.children[0], hobBody = hob.children.find(node => node.isMesh && node.geometry.parameters.height > .01);
      const ovenCenter = new THREE.Box3().setFromObject(ovenBody).getCenter(new THREE.Vector3());
      const hobCenter = new THREE.Box3().setFromObject(hobBody).getCenter(new THREE.Vector3());
      const ovenLocal = oven.worldToLocal(ovenCenter.clone()), hobLocal = oven.worldToLocal(hobCenter.clone());
      near(ovenLocal.x, hobLocal.x, 'oven and cooktop share the cabinet column');
      near(hobLocal.z, 0, 'cooktop is centered in the countertop cutout');
      const hobBox = new THREE.Box3().setFromObject(hobBody), ovenBox = new THREE.Box3().setFromObject(ovenBody);
      assert.ok(hobBox.min.y > ovenBox.max.y, 'oven and cut-in cooktop have a physical vertical gap');
      const inverse = hobBody.matrixWorld.clone().invert(), innerBox = new THREE.Box3().setFromBufferAttribute(hobBody.geometry.attributes.position).expandByScalar(-.000001);
      let slabCount = 0;
      root.traverse(mesh => {
        if (!mesh.isMesh || mesh.geometry.type !== 'ExtrudeGeometry') return;
        slabCount++;
        const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld), positions = mesh.geometry.attributes.position, indices = mesh.geometry.index;
        for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
          const points = [0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset).applyMatrix4(matrix));
          assert.equal(innerBox.intersectsTriangle(new THREE.Triangle(...points)), false, 'countertop triangle crosses the inserted cooktop');
        }
      });
      assert.equal(slabCount, 1);
    } finally { dispose(root); }
  }
});

test('single oven bounds match physical handles for base and tall cabinets with every handle style and rotation', () => {
  for (const type of ['base', 'tall']) for (const handleStyle of ['bar', 'knob', 'push-open']) for (const rotation of [0, Math.PI / 2, -.41]) {
    const c = cabinet(type, 'oven', { handleStyle }); c.position.rotation = rotation;
    const design = kitchen([c]), root = render(design, true);
    try {
      const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), expected = kitchenEnvelope(design);
      near(size.y, expected.h, `${type}/${handleStyle}/height`);
      if (rotation === 0 || rotation === Math.PI / 2) {
        near(size.x, expected.w, `${type}/${handleStyle}/width`);
        near(size.z, expected.d, `${type}/${handleStyle}/depth`);
        const center = box.getCenter(new THREE.Vector3());
        near(center.x, 0); near(center.z, 0);
      } else {
        // The authored collision footprint conservatively extends handles across the whole
        // front edge; after oblique rotations it may exceed the actual mesh bounds slightly.
        assert.ok(box.min.x >= -expected.w / 2 - 1e-6 && box.max.x <= expected.w / 2 + 1e-6);
        assert.ok(box.min.z >= -expected.d / 2 - 1e-6 && box.max.z <= expected.d / 2 + 1e-6);
      }
    } finally { dispose(root); }
  }
});

test('oven and cooktop survive a kitchen export snapshot while external room geometry stays out', () => {
  const { snapshotKitchen } = loadSource('src/three/kitchenExport.ts');
  const c = cabinet(), root = render(kitchen([c])), room = new THREE.Group();
  root.userData.kitchenExport = true; room.add(root);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(8, .1, 8)); floor.name = 'Floor'; room.add(floor);
  const snapshot = snapshotKitchen(root);
  try {
    assert.ok(snapshot.scene.getObjectByName(`Appliance-oven-${c.id}`));
    assert.ok(snapshot.scene.getObjectByName(`Appliance-cooktop-${c.id}`));
    assert.equal(snapshot.scene.getObjectByName('Floor'), undefined);
  } finally { snapshot.dispose(); dispose(room); }
});
