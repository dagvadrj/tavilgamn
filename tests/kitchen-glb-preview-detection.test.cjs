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

test("a glass pane in its frame is one front, not two carcass sides", () => {
  // Two identical boards in one plane (frame + glass) and a door above them.
  const parts = [
    board(0, [0, 1440, -22], [600, 1810, -7]),
    board(1, [0, 1440, -22], [600, 1810, -7]),
    board(2, [0, 1811, -22], [600, 2340, -2]),
    board(3, [600, 1440, -22], [1200, 2340, -2]),
  ];
  const { modules: found } = modules.detectKitchenGlbModules(parts);
  const first = found.find((item) => item.parts.includes(0));
  assert.ok(first, "the framed glass door forms a module");
  assert.equal(first.role, "wall");
  assert.equal(first.widthMm, 600);
});

test("one mesh carrying a whole run's carcass belongs to every cabinet in front of it", () => {
  const front = (id, x0, x1) => board(id, [x0, 120, -252], [x1, 850, -232]);
  const parts = [
    front(0, 0, 600), front(1, 600, 1200), front(3, 1200, 1800),
    { id: 2, name: "carcass", materials: [], box: { min: [0, 120, -231], max: [1800, 880, 349] } },
  ];
  const detection = modules.detectKitchenGlbModules(parts);
  const measured = checks.kitchenGlbMeasureModules(detection, parts).modules;
  assert.equal(measured.length, 3);
  for (const cabinet of measured) {
    assert.ok(cabinet.parts.includes(2));
    assert.equal(cabinet.depthMm, 601);
    assert.equal(cabinet.measured.depth, "carcass");
  }
});

test("issue fixes round a front-measured width and mark it as entered", () => {
  const cabinet = {
    id: "m1", role: "base", name: "Доод шүүгээ 600", widthMm: 599, heightMm: 850, depthMm: 600, parts: [], facing: "-z",
    measured: { width: "front", height: "carcass", depth: "carcass" },
    box: { min: [0, 0, 0], max: [599, 850, 600] },
  };
  const detection = { modules: [cabinet], fronts: 1, countertopM2: 0, backsplashM2: 0, countertopParts: [], appliances: [] };
  const issue = checks.kitchenGlbModuleIssues(detection, []).find((item) => item.fix);
  assert.equal(issue.fix.label, "600 мм болгох");
  const [fixed] = checks.kitchenGlbApplyFix([cabinet], issue.fix);
  assert.equal(fixed.widthMm, 600);
  assert.equal(fixed.measured.width, "manual");
});

test("a side panel read as a front is turned to its row's facing", () => {
  const unit = (id, facing, x0, x1, z0, z1) => ({
    id, role: "wall", name: id, widthMm: 600, heightMm: 900, depthMm: 330, parts: [], facing,
    measured: { width: "carcass", height: "carcass", depth: "carcass" },
    box: { min: [x0, 1440, z0], max: [x1, 2340, z1] },
  });
  const detection = {
    modules: [unit("m1", "-x", -1349, -730, -22, 349), unit("m2", "-z", -729, -130, -21, 309), unit("m3", "-z", -129, 470, -21, 309)],
    fronts: 3, countertopM2: 0, backsplashM2: 0, countertopParts: [], appliances: [],
  };
  const issue = checks.kitchenGlbModuleIssues(detection, []).find((item) => item.fix?.label === "Эгнээний чиглэлд эргүүлэх");
  assert.deepEqual(issue.moduleIds, ["m1"]);
  const [turned] = checks.kitchenGlbApplyFix(detection.modules, issue.fix);
  assert.equal(turned.facing, "-z");
  assert.equal(turned.widthMm, 619);
  assert.equal(turned.depthMm, 371);
});
