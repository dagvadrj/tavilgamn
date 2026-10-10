const { test } = require("node:test");
const assert = require("node:assert/strict");
const THREE = require("three");
const { loadSource } = require("./helpers/load-source.cjs");
const band = loadSource("src/three/furnitureFloorBand.ts");
const { ROOM_SKIRTING_DEPTH, ROOM_SKIRTING_HEIGHT } = loadSource(
  "src/lib/roomRendering.ts",
);
const dims = { w: 1, d: 1, h: 0.4 };
const model = {
  id: "legged",
  dimensionsW: 1,
  dimensionsD: 1,
  dimensionsH: 0.4,
};
const collision = loadSource("src/three/collision.ts", {
  "@/lib/modelFloorBand": band,
  "@/lib/modelRegistry": { getDbModel: () => model },
  "@/store/catalog": { getProduct: () => undefined },
});
const piece = (z = -1.5) => ({
  instanceId: "placed",
  productId: "legged",
  modelId: "legged",
  x: 0,
  z,
  rotation: 0,
  color: "#fff",
  material: "fabric",
});
const room = {
  width: 4,
  depth: 4,
  height: 2.7,
  skirting: [{ minX: -2, maxX: 2, minZ: -2, maxZ: -1.98 }],
};
function mesh(w, h, d, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial(),
  );
  m.position.set(x, y, z);
  return m;
}
function sofa(legZ = 0.35) {
  const scene = new THREE.Group();
  scene.add(mesh(1, 0.2, 1, 0, 0.3, 0));
  for (const x of [-0.35, 0.35])
    for (const z of [-legZ, legZ]) scene.add(mesh(0.04, 0.2, 0.04, x, 0.1, z));
  scene.updateMatrixWorld(true);
  return scene;
}
function register(scene, id = "legged", source = "high", high = true) {
  band.registerModelFloorBand(
    id,
    scene,
    new THREE.Box3(
      new THREE.Vector3(-0.5, 0, -0.5),
      new THREE.Vector3(0.5, 0.4, 0.5),
    ),
    dims,
    false,
    source,
    high,
  );
}

test("skirting is 20 mm deep and 60 mm tall; raised sofa body can overlap it", () => {
  assert.equal(ROOM_SKIRTING_DEPTH, 0.02);
  assert.equal(ROOM_SKIRTING_HEIGHT, 0.06);
  register(sofa());
  assert.equal(band.modelFloorBand("legged", dims).length, 4);
  assert.equal(
    collision.isPlacementValid(piece(), [], room),
    true,
    "body touches the wall but inset feet clear the skirting",
  );
});
test("floor feet stop at the skirting and wall snap leaves exact 20 mm clearance", () => {
  register(sofa(0.48), "legged", "changed-high");
  assert.equal(collision.isPlacementValid(piece(-1.49), [], room), false);
  assert.equal(collision.isPlacementValid(piece(-1.48), [], room), true);
  const snapped = collision.snapToWall(piece(-1.3), room);
  assert.ok(Math.abs(snapped.z + 1.48) < 0.000001);
  assert.equal(collision.isPlacementValid(snapped, [], room), true);
});
test("height-band clipping catches legs with no vertex in the band and ignores geometry above it", () => {
  const scene = new THREE.Group();
  scene.add(mesh(0.04, 0.2, 0.04, 0.35, 0.1, 0.35), mesh(1, 0.1, 1, 0, 0.3, 0));
  register(scene, "clipped");
  const rects = band.modelFloorBand("clipped", dims);
  assert.equal(rects.length, 1);
  assert.ok(Math.abs(rects[0].minZ - 0.33) < 0.000001);
  assert.ok(Math.abs(rects[0].maxZ - 0.37) < 0.000001);
  const raised = new THREE.Group();
  raised.add(mesh(1, 0.1, 1, 0, 0.3, 0));
  register(raised, "raised");
  assert.deepEqual(band.modelFloorBand("raised", dims), []);
});
test("normalized source scale is applied before the floor band and high footprints survive preview reuse", () => {
  const scene = sofa();
  scene.scale.setScalar(1000);
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3(
    new THREE.Vector3(-500, 0, -500),
    new THREE.Vector3(500, 400, 500),
  );
  band.registerModelFloorBand(
    "scaled",
    scene,
    bounds,
    dims,
    false,
    "scaled-high",
    true,
  );
  const rects = band.modelFloorBand("scaled", dims);
  assert.ok(Math.abs(rects[0].minZ + 0.37) < 0.000001);
  band.registerModelFloorBand(
    "scaled",
    new THREE.Group(),
    bounds,
    dims,
    false,
    "scaled-preview",
    false,
  );
  assert.deepEqual(band.modelFloorBand("scaled", dims), rects);
});
test("open seams remove their skirting; wall-door apertures also leave a skirting gap", () => {
  const layout = loadSource("src/lib/roomLayout.ts"),
    { roomPlacementContext } = loadSource("src/three/roomPlacement.ts");
  const a = {
      id: "a",
      name: "a",
      type: "living",
      width: 4,
      depth: 4,
      height: 2.7,
      position: { x: 0, z: 0 },
      pieces: [],
      openings: [
        {
          id: "door",
          kind: "door",
          templateId: "door-single",
          wallId: "north",
          position: 0.5,
          width: 1,
          height: 2.1,
          sillHeight: 0,
        },
      ],
    },
    b = { ...a, id: "b", position: { x: 4, z: 0 }, openings: [] };
  const c = {
    ...layout.defaultConnection(layout.roomContacts(a, b)[0], [a, b]),
    kind: "open",
  };
  const ctx = roomPlacementContext({
    ...a,
    id: "plan",
    rooms: [a, b],
    activeRoomId: "a",
    connections: [c],
    pieces: [],
  });
  assert.equal(
    ctx.room.skirting.some(
      (r) => r.minX >= 1.98 && r.maxX <= 2.02 && r.minZ < 1 && r.maxZ > -1,
    ),
    false,
  );
  assert.equal(
    ctx.room.skirting.some((r) => r.minZ === -2 && r.minX < 0 && r.maxX > 0),
    false,
  );
});
