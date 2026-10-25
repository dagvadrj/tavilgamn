const {test} = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const {loadSource} = require('./helpers/load-source.cjs');
const {configureModelCutoutSampling} = loadSource('src/three/modelCutoutSampling.ts');
const renderer = antialias => ({getContext: () => ({getContextAttributes: () => ({antialias})})});

test('multisample coverage smooths masked silhouettes while preserving authored materials and normals', () => {
  const leaf = new THREE.MeshStandardMaterial({alphaTest: .5, map: new THREE.Texture(), side: THREE.DoubleSide});
  const glass = new THREE.MeshPhysicalMaterial({transparent: true, opacity: .35, alphaTest: .01});
  const solid = new THREE.MeshStandardMaterial();
  const scene = new THREE.Group(), geometry = new THREE.BoxGeometry();
  scene.add(new THREE.Mesh(geometry, [leaf, glass, solid]), new THREE.Mesh(geometry, leaf));
  const normals = geometry.getAttribute('normal'), map = leaf.map, version = leaf.version;
  configureModelCutoutSampling(scene, renderer(true));
  assert.equal(leaf.alphaToCoverage, true);
  assert.equal(leaf.version, version + 1, 'shared leaf material is updated once');
  assert.equal(leaf.alphaTest, .5);
  assert.equal(leaf.side, THREE.DoubleSide);
  assert.equal(leaf.map, map);
  assert.equal(geometry.getAttribute('normal'), normals);
  assert.equal(glass.alphaToCoverage, false);
  assert.equal(glass.opacity, .35);
  assert.equal(solid.alphaToCoverage, false);
  configureModelCutoutSampling(scene, renderer(true));
  assert.equal(leaf.version, version + 1);
});

test('single-sample or unavailable contexts preserve alpha testing', () => {
  const material = new THREE.MeshStandardMaterial({alphaTest: .5});
  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(), material));
  for (const context of [renderer(false), {}, {getContext: () => ({getContextAttributes: () => null})}]) {
    configureModelCutoutSampling(scene, context);
    assert.equal(material.alphaToCoverage, false);
  }
});
