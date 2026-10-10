const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { loadSource } = require("./helpers/load-source.cjs");

const { createSuggestedKitchen } = loadSource("src/lib/kitchenSuggestions.ts");
const { placementIssues } = loadSource("src/lib/kitchenPlacement.ts");
const { parseKitchen } = loadSource("src/lib/kitchenAssembly.ts");

test("all appliance choices fit a small room without changing its size or dropping appliances", () => {
  for (const oven of ["under-worktop", "high-cabinet"])
    for (const hood of ["integrated", "wall", "none"])
      for (const refrigerator of ["integrated", "freestanding", "none"])
        for (const layout of ["straight", "l-right", "u", "double-side"]) {
          const kitchen = createSuggestedKitchen({ oven, hood, refrigerator, layout }, { width: 3, depth: 2, height: 2.7 });
          assert.doesNotThrow(() => parseKitchen(kitchen), JSON.stringify({ oven, hood, refrigerator, layout }));
          assert.deepEqual(kitchen.room, { width: 3000, depth: 2000, height: 2700 });
          assert.ok(kitchen.cabinets.some(c => c.opening === "oven"));
          assert.ok(kitchen.cabinets.some(c => c.opening === "sink"));
          assert.equal(kitchen.cabinets.some(c => c.opening === "hood"), hood !== "none");
          assert.equal(kitchen.cabinets.some(c => c.opening === "refrigerator"), refrigerator !== "none");
        }
});

test("suggestion keeps the room dimensions selected before appliance choices", () => {
  const kitchen = createSuggestedKitchen({ oven: "under-worktop", hood: "none", refrigerator: "none", layout: "straight" }, { width: 3, depth: 2, height: 2.7 });
  assert.deepEqual(kitchen.room, { width: 3000, depth: 2000, height: 2700 });
  assert.equal(kitchen.layout, "straight");
});

test("kitchen suggestion creates the chosen appliances and a valid editable layout", () => {
  const kitchen = createSuggestedKitchen({
    oven: "high-cabinet",
    hood: "wall",
    refrigerator: "freestanding",
    layout: "l-right",
  });

  assert.equal(kitchen.layout, "l-right");
  assert.equal(kitchen.cabinets.filter((c) => c.opening === "oven").length, 1);
  assert.equal(kitchen.cabinets.find((c) => c.opening === "oven").type, "tall");
  assert.equal(
    kitchen.cabinets.find((c) => c.opening === "hood").hoodMount,
    "wall",
  );
  assert.equal(
    kitchen.cabinets.find((c) => c.opening === "refrigerator")
      .refrigeratorStyle,
    "side-by-side",
  );
  assert.equal(
    placementIssues(kitchen).some((issue) => issue.severity === "error"),
    false,
  );
});

test("optional appliances can be omitted and the kitchen route starts directly in the editor", () => {
  const kitchen = createSuggestedKitchen({
    oven: "under-worktop",
    hood: "none",
    refrigerator: "none",
    layout: "straight",
  });

  assert.equal(kitchen.cabinets.filter((c) => c.opening === "oven").length, 1);
  assert.equal(
    kitchen.cabinets.some((c) => c.opening === "hood"),
    false,
  );
  assert.equal(
    kitchen.cabinets.some((c) => c.opening === "refrigerator"),
    false,
  );

  const route = fs.readFileSync("src/components/KitchenPlanner.tsx", "utf8");
  const editor = fs.readFileSync(
    "src/components/ModularKitchenPlanner.tsx",
    "utf8",
  );
  assert.doesNotMatch(route, /KitchenSuggestionWizard/);
  assert.match(route, /<ModularKitchenPlanner/);
  assert.match(editor, /kp-shell/);
  assert.match(editor, /onDeselect/);
});
