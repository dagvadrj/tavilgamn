const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { configureModelDefaultMaterials } = loadSource('src/three/modelDefaultMaterials.ts');

test('unassigned glTF panels use neutral paint while authored metal and textures retain their values', () => {
  const scene = new THREE.Group(), geometry = new THREE.BoxGeometry();
  const implicit = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 1 });
  const authored = implicit.clone();
  const textured = implicit.clone(); textured.map = new THREE.Texture();
  const named = implicit.clone(); named.name = 'Intentional metal';
  const normal = geometry.getAttribute('normal').array.slice();
  for (const material of [implicit, authored, textured, named]) scene.add(new THREE.Mesh(geometry, material));
  scene.add(new THREE.Mesh(geometry, implicit));
  const associations = new Map([[authored, { materials: 0 }]]);
  configureModelDefaultMaterials(scene, associations);
  assert.equal(implicit.metalness, 0);
  assert.equal(implicit.roughness, 0.65);
  assert.equal(implicit.color.getHex(), 0xffffff);
  assert.equal(implicit.userData.plannerUnassignedMaterial, true);
  for (const material of [authored, textured, named]) {
    assert.equal(material.metalness, 1);
    assert.equal(material.roughness, 1);
    assert.equal(material.userData.plannerUnassignedMaterial, undefined);
  }
  assert.deepEqual(geometry.getAttribute('normal').array, normal);
  const version = implicit.version;
  configureModelDefaultMaterials(scene, associations);
  assert.equal(implicit.version, version, 'repeated preparation is idempotent');
  geometry.dispose(); textured.map.dispose();
  for (const material of [implicit, authored, textured, named]) material.dispose();
});

test('missing parser associations never imply permission to replace an authored material', () => {
  const scene = new THREE.Group(), material = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material); scene.add(mesh);
  configureModelDefaultMaterials(scene);
  assert.equal(material.metalness, 1);
  mesh.geometry.dispose(); material.dispose();
});
