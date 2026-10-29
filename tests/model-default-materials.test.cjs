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

test('authored materials that omit metallicFactor become dielectric; explicit metal stays metal', () => {
  const scene = new THREE.Group(), geometry = new THREE.BoxGeometry();
  const fabric = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 1 }); fabric.name = 'Material_0.001'; fabric.map = new THREE.Texture();
  const legs = fabric.clone(); legs.name = 'Legs';
  const mapped = fabric.clone(); mapped.name = 'Mapped'; mapped.metalnessMap = new THREE.Texture();
  for (const material of [fabric, legs, mapped]) scene.add(new THREE.Mesh(geometry, material));
  const associations = new Map([[fabric, { materials: 0 }], [legs, { materials: 1 }], [mapped, { materials: 2 }]]);
  const definitions = [
    { pbrMetallicRoughness: { baseColorTexture: { index: 0 } } },
    { pbrMetallicRoughness: { metallicFactor: 1 } },
    { pbrMetallicRoughness: { metallicRoughnessTexture: { index: 1 } } },
  ];
  configureModelDefaultMaterials(scene, associations, definitions);
  assert.equal(fabric.metalness, 0);
  assert.equal(fabric.roughness, 1, 'only the implicit metal value changes');
  assert.equal(fabric.userData.plannerImplicitMetalness, true);
  assert.equal(legs.metalness, 1);
  assert.equal(mapped.metalness, 1);
  geometry.dispose(); fabric.map.dispose(); mapped.metalnessMap.dispose();
  for (const material of [fabric, legs, mapped]) material.dispose();
});

test('missing parser associations never imply permission to replace an authored material', () => {
  const scene = new THREE.Group(), material = new THREE.MeshStandardMaterial({ metalness: 1, roughness: 1 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material); scene.add(mesh);
  configureModelDefaultMaterials(scene);
  assert.equal(material.metalness, 1);
  mesh.geometry.dispose(); material.dispose();
});
