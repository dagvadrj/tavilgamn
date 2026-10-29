const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { loadSource } = require("./helpers/load-source.cjs");
const { createModularKitchen, createCabinet } = loadSource(
  "src/lib/kitchenCabinets.ts",
);
const { parseKitchen, cloneKitchen } = loadSource("src/lib/kitchenAssembly.ts");
const {
  kitchenLightStrips,
  DEFAULT_KITCHEN_LINE_LIGHTING,
  parseKitchenLineLighting,
} = loadSource("src/lib/kitchenLighting.ts");
const { placeKitchenPlanningFurniture } = loadSource(
  "src/lib/kitchenPlanningFurniture.ts",
);
const { recommendKitchenCorner, arrangeKitchenCorner } = loadSource(
  "src/lib/kitchenCornerLayout.ts",
);
const { placementIssues, cabinetsOverlap, cabinetCorners } = loadSource(
  "src/lib/kitchenPlacement.ts",
);
const { roomContainsFootprint } = loadSource("src/lib/kitchenRoomOutline.ts");
const { buildKitchenBom } = loadSource("src/lib/kitchenBom.ts");
function nodes(node) {
  return !React.isValidElement(node)
    ? []
    : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
}

test("automatic corners find another valid split when a fixed split cannot fit, without changing authored models", () => {
  const original = createModularKitchen();
  original.room = { width: 2200, depth: 3300, height: 2600 };
  original.cabinets = original.cabinets.filter((c) => c.type === "base");
  const before = JSON.stringify(original);
  for (const side of ["left", "right"]) {
    assert.throws(() =>
      arrangeKitchenCorner(original, { side, mainCount: 3, clearanceMm: 60 }),
    );
    const next = recommendKitchenCorner(original, side);
    assert.ok(next.cornerPlan.mainCount < 3);
    assert.deepEqual(
      placementIssues(next).filter((i) => i.severity === "error"),
      [],
    );
    assert.deepEqual(
      next.cabinets.map((c) => [c.id, c.width, c.height, c.depth]),
      original.cabinets.map((c) => [c.id, c.width, c.height, c.depth]),
    );
    assert.deepEqual(parseKitchen(next).cornerPlan, next.cornerPlan);
  }
  assert.equal(JSON.stringify(original), before);
});

test("continuous lighting merges neighboring units, follows rotated runs, preserves gaps, and totals physical length", () => {
  const k = createModularKitchen();
  k.lineLighting = {
    ...DEFAULT_KITCHEN_LINE_LIGHTING,
    underCabinet: true,
    plinth: true,
  };
  const second = createCabinet("wall", "wall-2");
  second.position.x = k.cabinets.at(-1).position.x + 600;
  k.cabinets.push(second);
  let strips = kitchenLightStrips(k);
  assert.deepEqual(
    strips.map((s) => s.length).sort((a, b) => a - b),
    [1200, 2400],
  );
  second.position.x += 200;
  assert.equal(
    kitchenLightStrips(k).filter((s) => s.kind === "underCabinet").length,
    2,
  );
  const corner = recommendKitchenCorner(k, "left");
  strips = kitchenLightStrips(corner);
  assert.equal(
    strips
      .filter((s) => s.kind === "plinth")
      .reduce((sum, s) => sum + s.length, 0),
    2400,
  );
  assert.ok(
    strips.some((s) => Math.abs(s.position.rotation - Math.PI / 2) < 0.001),
  );
  const rows = buildKitchenBom(corner, [], []).items.filter((i) =>
    i.id.startsWith("line-"),
  );
  assert.ok(
    Math.abs(
      rows.reduce((sum, r) => sum + r.quantity, 0) -
        strips.reduce((sum, s) => sum + s.length, 0) / 1000,
    ) < 1e-9,
  );
  assert.ok(rows.every((r) => r.unitPrice === null && r.unit === "м"));
});

test("line-light settings round trip without changing legacy designs and reject invalid input", () => {
  const k = createModularKitchen();
  assert.equal(parseKitchen(k).lineLighting, undefined);
  k.lineLighting = {
    underCabinet: true,
    plinth: true,
    tone: "cool",
    brightness: 35,
  };
  assert.deepEqual(
    parseKitchen(JSON.parse(JSON.stringify(k))).lineLighting,
    k.lineLighting,
  );
  const copy = cloneKitchen(k);
  copy.lineLighting.brightness = 0;
  assert.equal(k.lineLighting.brightness, 35);
  for (const value of [
    null,
    {},
    { ...k.lineLighting, brightness: 101 },
    { ...k.lineLighting, brightness: NaN },
    { ...k.lineLighting, underCabinet: "true" },
    { ...k.lineLighting, tone: "red" },
  ])
    assert.throws(() => parseKitchenLineLighting(value));
});

test("islands and bars reserve their whole top, keep a working aisle, can be restored and appear in estimates", () => {
  for (const kind of ["island", "bar"]) {
    const k = createModularKitchen(),
      before = JSON.stringify(k);
    const item = placeKitchenPlanningFurniture(k, kind, `new-${kind}`);
    assert.ok(item);
    assert.ok(roomContainsFootprint(k.room, cabinetCorners(item)));
    const aisle = {
      ...item,
      width: item.width + 1800,
      depth: item.depth + 1800,
    };
    assert.ok(
      k.cabinets
        .filter((c) => c.type !== "wall")
        .every((c) => !cabinetsOverlap(aisle, c)),
    );
    k.extras = [item];
    assert.deepEqual(
      placementIssues(k).filter((i) => i.severity === "error"),
      [],
    );
    const restored = parseKitchen(JSON.parse(JSON.stringify(k)));
    assert.deepEqual(restored.extras[0], item);
    const tooClose = {
      ...item,
      position: {
        ...item.position,
        x: 2000,
        z: item.depth / 2 + 650,
        rotation: 0,
      },
    };
    assert.ok(
      placementIssues({ ...k, extras: [tooClose] }).some(
        (i) => i.code === "aisle" && i.severity === "warning",
      ),
    );
    const row = buildKitchenBom(restored, [], []).items.find(
      (i) => i.id === item.id,
    );
    assert.equal(row.label, item.name);
    assert.equal(row.unitPrice, null);
    assert.equal(before.includes("planningFurniture"), false);
    assert.throws(() =>
      parseKitchen({ ...k, extras: [{ ...item, depth: 100 }] }),
    );
    assert.throws(() =>
      parseKitchen({
        ...k,
        extras: [{ ...item, planningFurniture: "unknown" }],
      }),
    );
  }
});

test("the save endpoint forwards light and planning-furniture settings to the versioned project unchanged", async () => {
  const k = createModularKitchen();
  k.lineLighting = {
    underCabinet: true,
    plinth: true,
    tone: "warm",
    brightness: 60,
  };
  k.extras = [placeKitchenPlanningFurniture(k, "island", "island-api")];
  let forwarded;
  const { PUT } = loadSource("src/app/api/kitchens/route.ts", {
    "@/lib/supabase/requireUser": {
      requireUser: async () => ({
        userId: "11111111-1111-4111-8111-111111111111",
      }),
    },
    "@/lib/supabase/admin": {
      getSupabaseAdmin: () => ({
        rpc: async (name, args) => {
          forwarded = args.p_design;
          return {
            data: { id: args.p_id, design: args.p_design, revision: 1 },
            error: null,
          };
        },
      }),
    },
  });
  const { NextRequest } = require("next/server");
  const response = await PUT(
    new NextRequest("https://local.test/api/kitchens", {
      method: "PUT",
      body: JSON.stringify({
        id: "22222222-2222-4222-8222-222222222222",
        name: "Features",
        design: k,
        expectedRevision: 0,
      }),
    }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual(forwarded.lineLighting, k.lineLighting);
  assert.deepEqual(forwarded.extras, k.extras);
});

test("furniture insertion rejects rooms without clearance and respects columns and an existing island", () => {
  const k = createModularKitchen();
  k.room.depth = 1800;
  const before = JSON.stringify(k);
  assert.equal(placeKitchenPlanningFurniture(k, "island", "no-room"), null);
  assert.equal(JSON.stringify(k), before);
  k.room = {
    width: 5000,
    depth: 5000,
    height: 2600,
    items: [
      {
        id: "column",
        kind: "column",
        wall: "back",
        x: 2500,
        z: 2500,
        width: 700,
        depth: 700,
      },
    ],
  };
  const first = placeKitchenPlanningFurniture(k, "island", "island-a");
  assert.ok(first);
  k.extras = [first];
  const second = placeKitchenPlanningFurniture(k, "bar", "bar-b");
  assert.ok(second);
  assert.deepEqual(
    placementIssues({ ...k, extras: [first, second] }).filter(
      (i) => i.severity === "error",
    ),
    [],
  );
});

test("planning furniture renders visible physical meshes and all new tools dispatch from the toolbar", () => {
  const { KitchenExtraMesh } = loadSource("src/three/KitchenExtraMesh.tsx");
  for (const kind of ["bar", "island"]) {
    const item = placeKitchenPlanningFurniture(
        createModularKitchen(),
        kind,
        kind,
      ),
      tree = KitchenExtraMesh({ extra: item });
    const boxes = nodes(tree).filter((n) => n.type === "boxGeometry");
    assert.ok(boxes.length >= 3);
    assert.deepEqual(boxes[0].props.args, [
      item.width / 1000,
      0.035,
      item.depth / 1000,
    ]);
    assert.ok(boxes.every((n) => n.props.args.every((x) => x > 0)));
  }
  const { KitchenPlannerHeader } = loadSource(
    "src/features/kitchen-planner/components/KitchenPlannerHeader.tsx",
  );
  const calls = [];
  const tree = KitchenPlannerHeader({
    stage: "design",
    onStage() {},
    onTool: (t) => calls.push(t),
    busy: false,
    canUndo: false,
    canRedo: false,
    onUndo() {},
    onRedo() {},
    loginHref: "/",
    name: "Draft",
    onName() {},
    subtotal: 0,
    utilities: null,
    annotations: false,
  });
  for (const label of ["Булан", "Шугаман гэрэл", "Тек / Арал"])
    nodes(tree)
      .find((n) => n.type === "button" && n.props["aria-label"] === label)
      .props.onClick();
  assert.deepEqual(calls, ["corner", "lighting", "island"]);
});
