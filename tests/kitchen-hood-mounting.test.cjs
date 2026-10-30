const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { createModularKitchen, createCabinet, createHood } = loadSource(
  "src/lib/kitchenCabinets.ts",
);
const { hoodMountPosition, snapKitchenHood, separateKitchenHoods } = loadSource(
  "src/lib/kitchenHoodMounting.ts",
);
const { resolveElevations, placementIssues } = loadSource(
  "src/lib/kitchenPlacement.ts",
);
const { extraFromProduct, findExtraSpace } = loadSource(
  "src/lib/kitchenExtras.ts",
);
const { parseKitchen } = loadSource("src/lib/kitchenAssembly.ts");
const { PCMALL_PRODUCTS } = loadSource("src/lib/pcmallAppliances.ts");
const { buildKitchenBom } = loadSource("src/lib/kitchenBom.ts");
const { kitchenLightStrips, DEFAULT_KITCHEN_LINE_LIGHTING } = loadSource(
  "src/lib/kitchenLighting.ts",
);
const { handoffWarnings } = loadSource("src/lib/kitchenWorkspace.ts");
const product = PCMALL_PRODUCTS.find((p) => p.model.file === "hood.glb");
const extra = () => extraFromProduct(product, "hood-extra");
function fixture() {
  const kitchen = createModularKitchen();
  kitchen.room = { width: 4000, depth: 3000, height: 2700 };
  const a = {
    ...createCabinet("wall", "box-a", 800),
    autoElevation: false,
    position: { x: 1000, y: 1500, z: 175, rotation: 0 },
  };
  const b = {
    ...createCabinet("wall", "box-b", 800),
    autoElevation: false,
    position: { x: 175, y: 1450, z: 1800, rotation: Math.PI / 2 },
  };
  return { ...kitchen, cabinets: [a, b], extras: [] };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("hoods keep physical dimensions, fit flush below shallow and deep boxes and never penetrate the wall", () => {
  for (const depth of [350, 598]) for (const rotation of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.37]) {
    const host = {
        ...createCabinet("wall", "host", 800),
        depth,
        position: { x: 1200, y: 1500, z: 900, rotation },
      },
      hood = extra();
    const position = hoodMountPosition(host, hood),
      dx = position.x - host.position.x,
      dz = position.z - host.position.z;
    near(dx * Math.cos(rotation) - dz * Math.sin(rotation), 0);
    const forward = dx * Math.sin(rotation) + dz * Math.cos(rotation);
    if (hood.depth <= host.depth) near(forward + hood.depth / 2, host.depth / 2);
    else near(forward - hood.depth / 2, -host.depth / 2);
    assert.ok(forward - hood.depth / 2 >= -host.depth / 2 - 1e-6);
    near(position.y + hood.height, host.position.y);
    assert.equal(position.rotation, rotation);
    const mounted = snapKitchenHood(
      { ...fixture(), cabinets: [host] },
      hood,
      position,
    );
    assert.deepEqual(
      [mounted.width, mounted.height, mounted.depth],
      [598, 85, 470],
    );
  }
});

test("dragging to another box replaces the mount, height and orientation; small, occupied and distant boxes do not attract", () => {
  let kitchen = fixture(),
    hood = findExtraSpace(kitchen, extra(), "box-a");
  assert.equal(hood.mount.cabinetId, "box-a");
  const before = JSON.stringify(kitchen);
  kitchen = { ...kitchen, extras: [hood] };
  const moved = snapKitchenHood(kitchen, hood, {
    ...hood.position,
    x: 235,
    z: 1800,
  });
  assert.equal(moved.mount.cabinetId, "box-b");
  assert.equal(moved.position.rotation, Math.PI / 2);
  assert.equal(moved.position.y, 1365);
  const small = { ...kitchen.cabinets[1], width: 500 };
  assert.equal(
    snapKitchenHood({ ...kitchen, cabinets: [small] }, hood, moved.position),
    null,
  );
  assert.equal(
    snapKitchenHood(
      { ...kitchen, extras: [{ ...moved, id: "other" }] },
      hood,
      moved.position,
    ),
    null,
  );
  assert.equal(
    snapKitchenHood(kitchen, hood, { ...hood.position, x: 3500, z: 2700 }),
    null,
  );
  assert.equal(JSON.stringify({ ...kitchen, extras: [] }), before);
});

test("mounted hoods follow moved boxes, survive save/restore, retain one BOM row and reject broken mounts", () => {
  let kitchen = fixture(),
    hood = findExtraSpace(kitchen, extra(), "box-a");
  kitchen.extras = [hood];
  kitchen = resolveElevations({
    ...kitchen,
    cabinets: kitchen.cabinets.map((c) =>
      c.id === "box-a"
        ? { ...c, position: { ...c.position, x: 1600, y: 1550 } }
        : c,
    ),
  });
  const moved = kitchen.extras[0];
  near(moved.position.x, 1600);
  near(moved.position.y, 1465);
  assert.deepEqual(
    placementIssues(kitchen).filter((i) => i.severity === "error"),
    [],
  );
  const restored = parseKitchen(JSON.parse(JSON.stringify(kitchen)));
  assert.deepEqual(restored.extras[0].mount, moved.mount);
  assert.deepEqual(restored.extras[0].position, moved.position);
  assert.equal(
    buildKitchenBom(restored, [], []).items.filter(
      (i) => i.productId === product.id,
    ).length,
    1,
  );
  assert.ok(
    handoffWarnings({ ...restored, unpricedCount: 0 }).some((w) =>
      w.includes("Агааржуулалтын"),
    ),
  );
  const lights = kitchenLightStrips({
    ...restored,
    lineLighting: { ...DEFAULT_KITCHEN_LINE_LIGHTING, underCabinet: true },
  }).filter((s) => s.kind === "underCabinet");
  assert.equal(
    lights.reduce((sum, s) => sum + s.length, 0),
    800,
    "the separate hood still interrupts the under-cabinet light strip",
  );
  assert.throws(
    () =>
      parseKitchen({
        ...kitchen,
        cabinets: kitchen.cabinets.filter((c) => c.id !== "box-a"),
      }),
    /box/,
  );
  assert.throws(() =>
    parseKitchen({
      ...kitchen,
      extras: [{ ...moved, mount: { kind: "under-cabinet", cabinetId: [] } }],
    }),
  );
});

test("legacy concealed hoods split from their box once, keep its GLB and align with normal upper elevation", () => {
  const kitchen = fixture(),
    old = {
      ...createHood("legacy", "under-cabinet", 800),
      variantId: "40000000-1025-4026-8000-000000000003",
      catalogAdaptation: "hood",
      applianceProductId: product.id,
    };
  kitchen.cabinets = [
    { ...old, position: { x: 1000, y: 1450, z: 175, rotation: 0 } },
  ];
  const source = JSON.stringify(kitchen),
    resolved = resolveElevations(kitchen),
    host = resolved.cabinets[0],
    hood = resolved.extras[0];
  assert.equal(host.variantId, old.variantId);
  assert.equal(host.opening, "doors");
  assert.equal(host.catalogAdaptation, undefined);
  assert.equal(host.position.y, 1420);
  assert.equal(hood.position.y + hood.height, host.position.y);
  assert.equal(hood.mount.cabinetId, host.id);
  assert.equal(separateKitchenHoods(resolved), resolved);
  assert.equal(
    parseKitchen(JSON.parse(JSON.stringify(kitchen))).extras.length,
    1,
  );
  assert.equal(JSON.stringify(kitchen), source);
});
