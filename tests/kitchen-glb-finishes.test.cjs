const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const checks = loadSource("src/lib/kitchenGlbChecks.ts");
const marketplace = loadSource("src/lib/kitchenMarketplace.ts");
const finishes = loadSource("src/lib/kitchenFinishes.ts");

const part = (id, min, max, materials = []) => ({ id, name: `p${id}`, materials, box: { min, max } });

test("material slots split faces, carcass, worktop and handles", () => {
  const parts = [
    part(0, [0, 100, 0], [600, 820, 18], ["front"]), // door, facing +z at z 0..18? (front is min side)
    part(1, [0, 100, 18], [18, 820, 580], ["body"]), // side
    part(2, [0, 100, 18], [600, 117, 580], ["body"]), // bottom
    part(3, [280, 600, -30], [320, 620, 0]), // knob proud of the door
    part(4, [0, 850, -20], [1200, 880, 600], ["stone"]), // worktop
    part(5, [600, 0, 0], [618, 850, 600], ["front"]), // end panel in the door finish
  ];
  const detection = {
    modules: [{
      id: "m1", role: "base", name: "", widthMm: 600, heightMm: 820, depthMm: 580, facing: "-z",
      parts: [0, 1, 2], box: { min: [0, 0, 0], max: [600, 840, 580] },
    }],
    fronts: 1, countertopM2: 0.7, backsplashM2: 0, countertopParts: [4], appliances: [],
  };
  const slots = checks.kitchenGlbMaterialSlots(detection, parts);
  assert.deepEqual(slots.front.sort(), [0, 5]);
  assert.deepEqual(slots.carcass.sort(), [1, 2]);
  assert.deepEqual(slots.countertop, [4]);
  assert.deepEqual(slots.handle, [3]);
});

test("slots sent with an upload are validated, never trusted", () => {
  assert.deepEqual(
    marketplace.readKitchenGlbSlots({ front: [1, 1, 2], carcass: [3], countertop: [], handle: [] }),
    { front: [1, 2], carcass: [3], countertop: [], handle: [] },
  );
  assert.equal(marketplace.readKitchenGlbSlots({ front: ["1"] }), null);
  assert.equal(marketplace.readKitchenGlbSlots({ front: [-1] }), null);
  assert.equal(marketplace.readKitchenGlbSlots({}), null);
  assert.equal(marketplace.readKitchenGlbSlots(null), null);
  assert.equal(marketplace.readKitchenGlbSlots({ front: Array.from({ length: 3001 }, (_, i) => i) }), null);
});

test("chosen finishes read as one line for the quote request", () => {
  assert.equal(
    finishes.kitchenFinishSummary({ front: "anthracite", countertop: "white-quartz", handle: "nope" }),
    "Нүүр: Антрацит · Тавцан: Цагаан кварц",
  );
  assert.equal(finishes.kitchenFinishSummary({}), "");
});
