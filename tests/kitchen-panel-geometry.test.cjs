const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { createCabinet, createHood, createRefrigerator } = loadSource('src/lib/kitchenCabinets.ts');
const { cabinetManufacturingPanels, cabinetFronts, cabinetDrawers, FRONT_GAP } = loadSource('src/lib/kitchenPanels.ts');
const { cabinetFrontExtra } = loadSource('src/lib/plitka.ts');
const { getComponentSize, getComponents } = loadSource('src/lib/kitchenComponents.ts');

test('displayed component dimensions come from the same authored faces and plinth boards', () => {
  const c = { ...createCabinet('base', 'fronts'), opening: 'drawers', drawerCount: 3 };
  const face = cabinetFronts(c)[0], size = getComponentSize(c, getComponents(c).find(p => p.type === 'drawer-front'));
  assert.equal(size.height,face.height); assert.equal(size.width,face.width);
  const corner = { ...createCabinet('base', 'corner',1000), corner:true, cornerSide:'right', doorCount:1 };
  assert.equal(getComponentSize(corner,getComponents(corner).find(p=>p.type==='door-front')).width,398);
  assert.equal(getComponentSize(c,getComponents(c).find(p=>p.type==='plinth')).depth,18);
  const hood=createHood('hood','under-cabinet');
  assert.equal(getComponentSize(hood,getComponents(hood).find(p=>p.type==='hood')).height,80);
  assert.equal(getComponentSize(hood,getComponents(hood).find(p=>p.type==='door-front')).height,638);
});

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
const penetrates = (a, b) => [0, 1, 2].every(axis =>
  Math.min(a.position[axis] + a.size[axis] / 2, b.position[axis] + b.size[axis] / 2) -
  Math.max(a.position[axis] - a.size[axis] / 2, b.position[axis] - b.size[axis] / 2) > 1e-6);

test('carcass, fronts and complete drawer boxes have no intersecting physical panels', () => {
  const samples = [];
  for (const type of ['base', 'wall', 'tall']) for (const style of ['flat', 'shaker', 'glass']) {
    samples.push({ ...createCabinet(type, `${type}-${style}`), opening: 'doors', frontStyle: style });
  }
  for (const drawerCount of [2, 3]) for (const height of [800, 820, 900]) for (const width of [400, 600, 800]) {
    samples.push({ ...createCabinet('base', `drawers-${drawerCount}-${height}-${width}`, width), opening: 'drawers', drawerCount, height });
  }
  samples.push({ ...createCabinet('base', 'corner', 1000), corner: true, cornerSide: 'right', doorCount: 1 });
  for (const type of ['base', 'tall']) samples.push({ ...createCabinet(type, `oven-${type}`), opening: 'oven' });
  samples.push(createHood('hood', 'under-cabinet'));
  for (const c of samples) {
    const panels = cabinetManufacturingPanels(c);
    for (const p of panels) {
      assert.ok(p.size.every(value => value > 0), `${c.id}/${p.id} is positive`);
      assert.ok(p.position[1] - p.size[1] / 2 >= -1e-6, `${c.id}/${p.id} above floor`);
      assert.ok(p.position[1] + p.size[1] / 2 <= c.height + 1e-6, `${c.id}/${p.id} below cabinet top`);
      for (const q of panels) if (p !== q) assert.equal(penetrates(p, q), false, `${c.id}: ${p.id} intersects ${q.id}`);
    }
  }
});

test('two and three drawer fronts keep exactly 2 mm joints with ascending opening travel', () => {
  for (const drawerCount of [2, 3]) for (const height of [800, 820, 899, 900]) {
    const c = { ...createCabinet('base', 'drawers'), opening: 'drawers', drawerCount, height };
    const fronts = cabinetFronts(c), drawers = cabinetDrawers(c);
    near(fronts[0].position[1] + fronts[0].height / 2, height - FRONT_GAP / 2);
    near(fronts.at(-1).position[1] - fronts.at(-1).height / 2, 80 + FRONT_GAP / 2);
    fronts.forEach((front, i) => {
      near(front.width, c.width - FRONT_GAP);
      assert.equal(drawers[i].panels.length, 5, 'both sides, back, inner front and bottom');
      if (i) {
        near(fronts[i - 1].position[1] - fronts[i - 1].height / 2 - (front.position[1] + front.height / 2), FRONT_GAP);
        assert.ok(drawers[i].travel > drawers[i - 1].travel, 'lower drawers open farther');
      }
      assert.ok(drawers[i].travel < c.depth - 70, 'drawer retains runner engagement');
    });
  }
});

test('blind corner has one accessible door and a fixed fascia with a 2 mm seam', () => {
  for (const cornerSide of ['left', 'right']) for (const type of ['base', 'wall']) {
    const c = { ...createCabinet(type, 'corner', type === 'base' ? 1000 : 800), corner: true, cornerSide, doorCount: 1 };
    const faces = cabinetFronts(c), door = faces.find(f => f.kind === 'door-front'), blind = faces.find(f => f.kind === 'filler');
    assert.equal(faces.length, 2);
    near(door.width, c.width - c.depth - FRONT_GAP);
    near(blind.width, c.depth - FRONT_GAP);
    near(Math.abs(door.position[0] - blind.position[0]) - (door.width + blind.width) / 2, FRONT_GAP);
    assert.equal(Math.sign(blind.position[0]), cornerSide === 'left' ? -1 : 1);
    assert.equal(blind.hinge, undefined);
  }
});

const { CabinetBody } = loadSource('src/three/KitchenCabinetBody.tsx', {
  react: { ...React, useMemo: fn => fn(), useEffect: () => {} },
  './kitchenTextures': { createKitchenTexture: () => null },
});
function render(node, parent = new THREE.Group()) {
  for (const element of React.Children.toArray(node)) {
    if (!React.isValidElement(element)) continue;
    if (typeof element.type === 'function') { render(element.type(element.props), parent); continue; }
    if (typeof element.type === 'symbol') { render(element.props.children, parent); continue; }
    const Geometry = { boxGeometry: THREE.BoxGeometry, sphereGeometry: THREE.SphereGeometry, circleGeometry: THREE.CircleGeometry,
      cylinderGeometry: THREE.CylinderGeometry }[element.type];
    if (Geometry) { parent.geometry = new Geometry(...element.props.args); continue; }
    if (!['mesh', 'group'].includes(element.type)) continue;
    const object = element.type === 'mesh' ? new THREE.Mesh() : new THREE.Group();
    for (const key of ['position', 'rotation', 'scale']) if (element.props[key]) object[key].fromArray(element.props[key]);
    object.name = element.props.name ?? '';
    object.userData = element.props.userData ?? {};
    parent.add(object); render(element.props.children, object);
  }
  return parent;
}
const dispose = root => root.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); });

test('new refrigerator and hood solids fit their exact declared footprint, including handles', () => {
  const samples = [createHood('direct', 'wall'), createHood('integrated', 'under-cabinet'),
    createRefrigerator('fridge-tb', 'top-bottom'), createRefrigerator('fridge-ss', 'side-by-side')];
  for (const c of samples) {
    const root = render(React.createElement(CabinetBody, { cabinet: c }));
    try {
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      near(box.min.x, -c.width / 2000); near(box.max.x, c.width / 2000);
      near(box.min.z, -c.depth / 2000); near(box.max.z, c.depth / 2000 + cabinetFrontExtra(c) / 1000);
      near(box.min.y, 0); near(box.max.y, c.height / 1000);
    } finally { dispose(root); }
  }
});

test('rendered board dimensions retain the authored mm values and all drawer panels travel together', () => {
  const c = { ...createCabinet('base', 'drawers'), opening: 'drawers', drawerCount: 3 };
  const closed = render(React.createElement(CabinetBody, { cabinet: c }));
  const opened = render(React.createElement(CabinetBody, { cabinet: c, open: true }));
  try {
    closed.updateMatrixWorld(true); opened.updateMatrixWorld(true);
    for (const panel of cabinetManufacturingPanels(c)) {
      const mesh = closed.getObjectByName(`Panel-${panel.id}`);
      assert.ok(mesh, `actual authored board ${panel.id} is rendered`);
      assert.deepEqual(mesh.userData.sizeMm, panel.size);
      for (const [axis, key] of ['width', 'height', 'depth'].entries()) near(mesh.geometry.parameters[key] * 1000, panel.size[axis]);
    }
    for (const drawer of cabinetDrawers(c)) {
      const group = opened.getObjectByName(`Drawer-${c.id}-${drawer.index + 1}`);
      near(group.position.z * 1000, drawer.travel);
      for (const panel of drawer.panels) {
        const a = closed.getObjectByName(`Panel-${panel.id}`).getWorldPosition(new THREE.Vector3());
        const b = opened.getObjectByName(`Panel-${panel.id}`).getWorldPosition(new THREE.Vector3());
        near((b.z - a.z) * 1000, drawer.travel);
      }
    }
  } finally { dispose(closed); dispose(opened); }
});
