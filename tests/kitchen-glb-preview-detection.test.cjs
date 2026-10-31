const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const modules = loadSource("src/lib/kitchenGlbModules.ts");
const checks = loadSource("src/lib/kitchenGlbChecks.ts");
const glb = loadSource("src/lib/kitchenDesignGlb.ts");

const board = (id, min, max) => ({ id, name: `b${id}`, materials: [], box: { min, max } });

test("a blind corner unit takes its whole carcass, not just its door", () => {
  // 1088 mm carcass: 544 mm door at one end, fixed blind panel at the other.
  const parts = [
    board(0, [0, 100, 560], [544, 796, 578]), // door
    board(1, [0, 117, 0], [18, 835, 560]), // left side
    board(2, [1070, 117, 0], [1088, 835, 560]), // right side
    board(3, [0, 100, 0], [1088, 117, 560]), // bottom
    board(4, [18, 117, 0], [1070, 835, 5]), // back
    board(5, [548, 100, 560], [1088, 800, 578]), // blind panel
  ];
  const detection = {
    modules: [{
      id: "m1", role: "base", name: "Доод шүүгээ 540", widthMm: 544, heightMm: 835, depthMm: 578,
      box: { min: [0, 0, 0], max: [544, 835, 578] }, parts: [0], facing: "+z",
    }],
    fronts: 1, countertopM2: 0, backsplashM2: 0, countertopParts: [], appliances: [],
  };
  const [corner] = checks.kitchenGlbMeasureModules(detection, parts).modules;
  assert.equal(corner.widthMm, 1088);
  assert.equal(corner.measured.width, "carcass");
  assert.deepEqual([...corner.parts].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5]);
});

test("a tall upper standing on the worktop is a wall unit", () => {
  assert.equal(modules.kitchenGlbRoleOf(883, 2630), "wall");
  assert.equal(modules.kitchenGlbRoleOf(0, 835), "base");
  assert.equal(modules.kitchenGlbRoleOf(0, 2600), "tall");
  assert.equal(modules.kitchenGlbRoleOf(900, 1500), null);
});

test("two wall runs and a peninsula read as a U", () => {
  const unit = (facing, x0, x1, z0, z1) => ({
    id: "", role: "base", name: "", widthMm: 600, heightMm: 835, depthMm: 560, parts: [], facing,
    box: { min: [x0, 0, z0], max: [x1, 835, z1] },
  });
  const info = { widthMm: 3254, depthMm: 4080, materialNames: [], nodeNames: [] };
  const detection = (items) => ({ modules: items, countertopM2: 0, backsplashM2: 0, fronts: 0, appliances: [] });
  const back = unit("+z", -600, 0, -2000, -1440);
  const side = unit("-x", 1060, 1620, -1000, -400);
  const peninsula = unit("-z", 0, 900, 280, 860);
  const layout = (items) => glb.kitchenGlbListingSuggestions(info, "k.glb", "modern", detection(items)).layout;
  assert.equal(layout([back, side, peninsula]), "u");
  assert.equal(layout([back, side]), "l-right");
  assert.equal(layout([back, peninsula]), "double-side");
  assert.equal(layout([back]), "straight");
});

test("a plinth is registered with every floor unit it hides the legs of", () => {
  const cabinet = (id, x0, x1) => ({
    id, role: "base", name: "", widthMm: x1 - x0, heightMm: 835, depthMm: 560, parts: [], facing: "+z",
    measured: { width: "solid", height: "solid", depth: "solid" },
    box: { min: [x0, 0, 0], max: [x1, 835, 560] },
  });
  const parts = [board(9, [0, 0, 500], [1200, 100, 518])];
  const detection = {
    modules: [cabinet("m1", 0, 600), cabinet("m2", 600, 1200)],
    fronts: 2, countertopM2: 0, backsplashM2: 0, countertopParts: [], appliances: [],
  };
  const measured = checks.kitchenGlbMeasureModules(detection, parts).modules;
  assert.deepEqual(measured.map((item) => item.parts), [[9], [9]]);
  assert.equal(checks.kitchenGlbPartCategories({ ...detection, modules: measured }, parts).get(9), "base");
});

test("an end panel against a cabinet is a finishing panel, not a loose board", () => {
  const detection = {
    modules: [{ id: "m1", role: "base", name: "", widthMm: 600, heightMm: 835, depthMm: 560, parts: [], facing: "+z",
      box: { min: [0, 0, 0], max: [600, 835, 560] } }],
    fronts: 1, countertopM2: 0, backsplashM2: 0, countertopParts: [], appliances: [],
  };
  const parts = [board(1, [600, 0, 0], [618, 835, 598])];
  assert.equal(checks.kitchenGlbPartCategories(detection, parts).get(1), "panel");
});
