const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { createUnifiedKitchen, arrangeKitchen } = loadSource('src/lib/kitchenAssembly.ts');
const { createRefrigerator, createHood } = loadSource('src/lib/kitchenCabinets.ts');
const { KitchenAssemblyMesh } = loadSource('src/three/KitchenAssemblyMesh.tsx', {
  react: { ...React, useMemo: fn => fn(), useEffect: () => {} },
  './kitchenTextures': { createKitchenTexture: () => null },
});
function render(node, parent = new THREE.Group()) {
  for (const element of React.Children.toArray(node)) {
    if (!React.isValidElement(element)) continue;
    if (typeof element.type === 'function') { render(element.type(element.props), parent); continue; }
    if (typeof element.type === 'symbol') { render(element.props.children, parent); continue; }
    const Geometry = { boxGeometry: THREE.BoxGeometry, sphereGeometry: THREE.SphereGeometry, circleGeometry: THREE.CircleGeometry,
      ringGeometry: THREE.RingGeometry, extrudeGeometry: THREE.ExtrudeGeometry, cylinderGeometry: THREE.CylinderGeometry }[element.type];
    if (Geometry) { parent.geometry = new Geometry(...element.props.args); continue; }
    if (element.type === 'meshStandardMaterial') {
      parent.material = new THREE.MeshStandardMaterial(Object.fromEntries(Object.entries(element.props).filter(([key, value]) => key !== 'children' && value !== undefined)));
      continue;
    }
    if (!['mesh', 'group'].includes(element.type)) continue;
    const object = element.type === 'mesh' ? new THREE.Mesh() : new THREE.Group();
    if (element.props.position) object.position.fromArray(element.props.position);
    if (element.props.rotation) object.rotation.fromArray(element.props.rotation);
    if (element.props.scale) object.scale.fromArray(element.props.scale);
    object.name = element.props.name ?? '';
    object.userData = element.props.userData ?? {};
    parent.add(object); render(element.props.children, object);
  }
  return parent;
}
class Reader {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(data => { this.result = data; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then(data => { this.result = `data:${blob.type};base64,${Buffer.from(data).toString('base64')}`; this.onloadend?.(); }); }
}
function dispose(root) { root.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); }); }
const nearMm = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < .001, `${label}: ${actual} vs ${expected} mm`);
test('actual GLB encoding and decoding preserve panel millimetres and all four layouts within 0.001 mm', async () => {
  const oldReader = global.FileReader; global.FileReader = Reader;
  const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { encodeKitchenGlb } = loadSource('src/three/kitchenExport.ts', { 'three/examples/jsm/exporters/GLTFExporter.js': { GLTFExporter } });
  try {
    for (const layout of ['straight', 'l-left', 'l-right', 'double-side']) for (const open of [false, true]) {
      const kitchen = arrangeKitchen(createUnifiedKitchen(), layout);
      const root = render(React.createElement(KitchenAssemblyMesh, { kitchen, open }));
      root.userData = { kitchenExport: true, units: 'meters' };
      const before = new THREE.Box3().setFromObject(root);
      const binary = await encodeKitchenGlb(root);
      if (process.env.KITCHEN_EXPORT_FIXTURE_DIR && !open) {
        const fs = require('node:fs'), path = require('node:path');
        fs.mkdirSync(process.env.KITCHEN_EXPORT_FIXTURE_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.KITCHEN_EXPORT_FIXTURE_DIR, `${layout}.glb`), Buffer.from(binary));
        fs.writeFileSync(path.join(process.env.KITCHEN_EXPORT_FIXTURE_DIR, `${layout}.json`), JSON.stringify({ min: before.min.toArray(), max: before.max.toArray() }));
      }
      assert.equal(new DataView(binary).getUint32(0, true), 0x46546c67);
      const decoded = (await new GLTFLoader().parseAsync(binary, '')).scene;
      const after = new THREE.Box3().setFromObject(decoded);
      for (const axis of ['x', 'y', 'z']) for (const side of ['min', 'max']) nearMm(after[side][axis] * 1000, before[side][axis] * 1000, `${layout} ${open} ${side}.${axis}`);
      let count = 0;
      decoded.traverse(mesh => {
        if (!mesh.isMesh || !mesh.userData.sizeMm) return;
        const dimensions = new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position).getSize(new THREE.Vector3()).toArray();
        dimensions.forEach((value, i) => nearMm(value * 1000, mesh.userData.sizeMm[i], `${mesh.name} panel axis${i}`));
        count++;
      });
      assert.ok(count > 50, 'authored millimetre metadata remains in the GLB');
      dispose(decoded); dispose(root);
    }
  } finally { global.FileReader = oldReader; }
});
test('new appliance external bounds agree with their exact editable footprint', () => {
  for (const cabinet of [createRefrigerator('top', 'top-bottom'), createRefrigerator('side', 'side-by-side'), createHood('hood', 'wall')]) {
    const kitchen = { ...createUnifiedKitchen(), cabinets: [cabinet], backsplash: false };
    const root = render(React.createElement(KitchenAssemblyMesh, { kitchen }));
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    nearMm(size.x * 1000, cabinet.width, 'width'); nearMm(size.y * 1000, cabinet.height, 'height'); nearMm(size.z * 1000, cabinet.depth, 'depth');
    dispose(root);
  }
});
