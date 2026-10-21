const test = require("node:test");
const assert = require("node:assert/strict");
const THREE = require("three");
const { computeMeshVolume } = require("three-bvh-csg");
const { loadSource } = require("./helpers/load-source.cjs");
const { createWallGeometry } = loadSource("src/three/wallCsg.ts");
const { assignWallSurfaceGroups } = loadSource(
  "src/three/wallSurfaceGroups.ts",
);

test("paint and section finishes preserve the solid wall, CSG holes and UV coordinates with two draw groups", () => {
  for (const cuts of [
    [],
    [{ x: 0, width: 1.2, height: 1.2, sillHeight: 0.75 }],
  ]) {
    const geometry = createWallGeometry(4, 2.7, 0.2, cuts, {
      start: 0.2,
      end: 0.2,
    });
    const position = geometry.getAttribute("position"),
      uv = geometry.getAttribute("uv");
    const volume = computeMeshVolume(geometry),
      count = geometry.index?.count ?? position.count;
    const bounds = geometry.boundingBox.clone();
    assignWallSurfaceGroups(geometry);
    assert.equal(geometry.getAttribute("position"), position);
    assert.equal(geometry.getAttribute("uv"), uv);
    assert.equal(geometry.index.count, count);
    assert.ok(Math.abs(computeMeshVolume(geometry) - volume) < 1e-6);
    assert.ok(geometry.boundingBox.equals(bounds));
    assert.equal(geometry.groups.length, 2);
    assert.deepEqual(
      geometry.groups.map((group) => group.materialIndex),
      [0, 1],
    );
    assert.equal(
      geometry.groups.reduce((sum, group) => sum + group.count, 0),
      count,
    );
    geometry.dispose();
  }
});

test("broad wall paint, solid top caps and opening jambs receive their own finish without closing the aperture", () => {
  const geometry = assignWallSurfaceGroups(
    createWallGeometry(4, 2.7, 0.2, [
      { x: 0, width: 1.2, height: 1.2, sillHeight: 0.75 },
    ]),
  );
  const materials = [
    new THREE.MeshBasicMaterial(),
    new THREE.MeshBasicMaterial(),
  ];
  const wall = new THREE.Mesh(geometry, materials);
  wall.updateMatrixWorld(true);
  const hit = (origin, direction) =>
    new THREE.Raycaster(
      new THREE.Vector3(...origin),
      new THREE.Vector3(...direction),
    ).intersectObject(wall)[0];
  try {
    assert.equal(hit([1.5, 0, 1], [0, 0, -1]).face.materialIndex, 0);
    assert.equal(hit([0, 3, 0], [0, -1, 0]).face.materialIndex, 1);
    assert.equal(hit([0, 0, 0], [1, 0, 0]).face.materialIndex, 1);
    assert.equal(
      hit([0, 0, 1], [0, 0, -1]),
      undefined,
      "the window stays a real opening",
    );
  } finally {
    geometry.dispose();
    materials.forEach((material) => material.dispose());
  }
});
