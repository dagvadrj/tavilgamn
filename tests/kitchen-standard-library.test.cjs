const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");
const { KITCHEN_STANDARD_CHOICES, standardCabinetWidths, createStandardKitchenCabinet } = loadSource("src/lib/kitchenStandardCatalog.ts");
const { validateCabinet, createModularKitchen } = loadSource("src/lib/kitchenCabinets.ts");
const { parseKitchen } = loadSource("src/lib/kitchenAssembly.ts");
const { findCabinetSpace, placementIssues } = loadSource("src/lib/kitchenPlacement.ts");
const { KitchenStandardLibrary } = loadSource("src/features/kitchen-planner/components/KitchenStandardLibrary.tsx");

test("built-in kitchen choices expose all previous cabinet and appliance types plus direct hob and sink choices", () => {
  assert.deepEqual(KITCHEN_STANDARD_CHOICES.map(choice => choice.id), ["base", "wall", "tall", "hob", "sink", "oven-base", "oven-tall", "hood-integrated", "hood-wall", "fridge-top", "fridge-side"]);
  const html = renderToStaticMarkup(React.createElement(KitchenStandardLibrary, {
    type: "base", width: 600, disabled: false, atLimit: false, onType() {}, onWidth() {}, onAdd() {},
  }));
  for (const choice of KITCHEN_STANDARD_CHOICES) assert.ok(html.includes(choice.label));
  assert.doesNotMatch(html, /<details/);
  assert.match(html, /Доод шүүгээ нэмэх/);
});

test("every offered width produces a valid cabinet that places and reloads with its appliance intact", () => {
  const expectedOpenings = { hob: "hob", sink: "sink", "oven-base": "oven", "oven-tall": "oven", "hood-integrated": "hood", "hood-wall": "hood", "fridge-top": "refrigerator", "fridge-side": "refrigerator" };
  for (const { id } of KITCHEN_STANDARD_CHOICES) {
    const widths = standardCabinetWidths(id);
    for (const width of widths.length ? widths : [600]) {
      const cabinet = createStandardKitchenCabinet(id, id, width, 2700);
      assert.equal(validateCabinet(cabinet), null, `${id} at ${width} mm`);
      assert.equal(cabinet.opening, expectedOpenings[id]);
      const placed = findCabinetSpace({ ...createModularKitchen(), room: { width: 4000, depth: 3000, height: 2700 }, cabinets: [] }, cabinet);
      assert.ok(placed, `${id} places`);
      assert.ok(!placementIssues(placed).some(issue => issue.severity === "error"));
      const restored = parseKitchen(JSON.parse(JSON.stringify(placed)));
      assert.equal(restored.cabinets[0].opening, expectedOpenings[id]);
      if (["hob", "sink", "hood-integrated", "hood-wall"].includes(id)) assert.ok(width >= 600);
      if (id === "oven-tall") assert.equal(cabinet.type, "tall");
      if (id === "oven-base") assert.equal(cabinet.type, "base");
      if (id === "fridge-side") assert.equal(cabinet.refrigeratorStyle, "side-by-side");
      if (id === "hood-wall") assert.equal(cabinet.hoodMount, "wall");
    }
  }
});

test("busy and full kitchens prevent adding more standard items", () => {
  const props = { type: "hob", width: 600, onType() {}, onWidth() {}, onAdd() {}, disabled: true, atLimit: true };
  const html = renderToStaticMarkup(React.createElement(KitchenStandardLibrary, props));
  assert.match(html, /<fieldset[^>]*disabled/);
  assert.match(html, /<button[^>]*class="kp-primary"[^>]*disabled/);
  assert.doesNotMatch(html, /value="300"|value="400"|value="450"|value="500"/);
});
