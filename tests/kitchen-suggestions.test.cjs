const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { loadSource } = require("./helpers/load-source.cjs");

const { createSuggestedKitchen } = loadSource("src/lib/kitchenSuggestions.ts");
const { placementIssues } = loadSource("src/lib/kitchenPlacement.ts");

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
