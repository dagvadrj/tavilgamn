const test = require("node:test");
const assert = require("node:assert/strict");
const THREE = require("three");
const { loadSource } = require("./helpers/load-source.cjs");
const { buildRaycastTrees, enableAcceleratedRaycast, RAYCAST_BVH_MIN_TRIANGLES } = loadSource("src/three/modelRaycast.ts");

const hits = (object, origin, direction) =>
  new THREE.Raycaster(origin, direction).intersectObject(object).map(hit => [hit.distance.toFixed(6), hit.faceIndex]);

test("dense furniture meshes get a shared BVH that returns the same hits as brute force", () => {
  enableAcceleratedRaycast();
  const dense = new THREE.SphereGeometry(1, 64, 40); // > 2000 triangles
  const small = new THREE.BoxGeometry(1, 1, 1);
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(dense, new THREE.MeshBasicMaterial());
  const clone = mesh.clone(); clone.position.x = 3;
  root.add(mesh, clone, new THREE.Mesh(small, new THREE.MeshBasicMaterial()));
  root.updateMatrixWorld(true);
  const rays = [[new THREE.Vector3(0.3, 0.2, 5), new THREE.Vector3(0, 0, -1)], [new THREE.Vector3(-5, 0.4, 0.1), new THREE.Vector3(1, 0, 0)]];
  const before = rays.map(([o, d]) => hits(root, o, d));
  buildRaycastTrees(root);
  assert.ok(dense.index.count / 3 >= RAYCAST_BVH_MIN_TRIANGLES);
  assert.ok(dense.boundsTree, "dense geometry indexed once, shared by its clone");
  assert.equal(small.boundsTree, undefined, "small parts stay brute force");
  assert.deepEqual(rays.map(([o, d]) => hits(root, o, d)), before);
});

test("morphing and instanced meshes are left without a static tree", () => {
  const morph = new THREE.SphereGeometry(1, 64, 40);
  morph.morphAttributes.position = [morph.attributes.position.clone()];
  const instanced = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 64, 40), new THREE.MeshBasicMaterial(), 2);
  const root = new THREE.Group();
  root.add(new THREE.Mesh(morph, new THREE.MeshBasicMaterial()), instanced);
  buildRaycastTrees(root);
  assert.equal(morph.boundsTree, undefined);
  assert.equal(instanced.geometry.boundsTree, undefined);
});
