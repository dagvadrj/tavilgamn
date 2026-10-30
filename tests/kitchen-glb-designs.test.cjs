const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { loadSource } = require("./helpers/load-source.cjs");

const glb = loadSource("src/lib/kitchenDesignGlb.ts");
const marketplace = loadSource("src/lib/kitchenMarketplace.ts");
const modules = loadSource("src/lib/kitchenGlbModules.ts");
const id = "12345678-1234-4234-8234-123456789abc";

/** A 3000 × 600 × 900 mm run exported in millimetres, Z up, far from the origin. */
async function cadExport() {
  const { Document, NodeIO } = require("@gltf-transform/core");
  const document = new Document();
  const buffer = document.createBuffer();
  const corners = [];
  for (const x of [0, 3000]) for (const y of [0, 600]) for (const z of [0, 900]) corners.push(x + 5000, y - 4000, z + 120);
  const position = document.createAccessor().setType("VEC3").setArray(new Float32Array(corners)).setBuffer(buffer);
  const indices = document
    .createAccessor()
    .setType("SCALAR")
    .setArray(new Uint16Array([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7, 0, 4, 1, 1, 4, 5]))
    .setBuffer(buffer);
  const material = document.createMaterial("Kitchen Sink");
  const mesh = document.createMesh("run").addPrimitive(
    document.createPrimitive().setAttribute("POSITION", position).setIndices(indices).setMaterial(material),
  );
  const oak = document.createMaterial("Oak veneer");
  const front = document.createMesh("front").addPrimitive(
    document.createPrimitive().setAttribute("POSITION", position).setIndices(indices).setMaterial(oak),
  );
  const scene = document.createScene();
  scene.addChild(document.createNode("base_600").setMesh(mesh));
  scene.addChild(document.createNode("wall_900").setMesh(front));
  document.createNode("Cooker PI6514TFD");
  scene.addChild(document.createNode("oven integra").setMesh(front));
  return new NodeIO().writeBinary(document);
}

test("full-kitchen GLB units are detected from a plausible kitchen size", () => {
  assert.equal(glb.detectKitchenGlbUnit(3.2), "m");
  assert.equal(glb.detectKitchenGlbUnit(3241), "mm");
  assert.equal(glb.detectKitchenGlbUnit(320), "cm");
  // 2.7 m exported in inches is 106 — not mm (0.1 m) and not cm (1.06 m).
  assert.equal(glb.detectKitchenGlbUnit(106.3), "in");
  assert.equal(glb.detectKitchenGlbUnit(0), "m");
});

test("browser preparation scales, stands up and bottom-centres a CAD export", async () => {
  const bytes = await cadExport();
  const source = new File([bytes], "Davga kitchen_v2.glb");
  const flat = await glb.prepareKitchenDesignGlb(source);
  assert.equal(flat.unit, "mm");
  // Without the Z-up fix the run lies on its back: 600 mm "tall".
  assert.equal(flat.info.heightMm, 600);
  const prepared = await glb.prepareKitchenDesignGlb(source, { zUp: true });
  assert.deepEqual(
    [prepared.info.widthMm, prepared.info.depthMm, prepared.info.heightMm],
    [3000, 600, 900],
  );
  assert.deepEqual(glb.kitchenGlbIssues(prepared.info), []);
  const { NodeIO, getBounds } = require("@gltf-transform/core");
  const document = await new NodeIO().readBinary(new Uint8Array(await prepared.file.arrayBuffer()));
  const info = glb.kitchenGlbDocumentInfo(document, getBounds, prepared.file.size);
  assert.deepEqual(info.origin, { x: 0, y: 0, z: 0 });
  assert.equal(prepared.file.name, "Davga-kitchen_v2.glb");
  assert.ok(info.materialNames.includes("Kitchen Sink"));
});

test("GLB names suggest appliances, materials and exact module counts", () => {
  const hints = glb.kitchenGlbListingSuggestions(
    {
      widthMm: 2418,
      depthMm: 2651,
      materialNames: ["Kitchen Sink", "OVEN INTEGRA", "Cooker PI6514TFD", "inox", "[Color M08]"],
      nodeNames: ["base_600", "base_800", "wall-900", "3DGeom-12", "base_600"],
    },
    "davga_belen-gal togoo.glb",
  );
  assert.equal(hints.cabinetCount, 3);
  assert.equal(hints.layout, "l-left");
  assert.deepEqual(hints.inclusions, ["Шүүгээ · 3 ш"]);
  // As in the planner BOM, appliances and plumbing are quoted separately.
  assert.deepEqual(hints.exclusions, ["Угаалтуур · 1 ш", "Шарах шүүгээ · 1 ш", "Плитка · 1 ш"]);
  assert.deepEqual(hints.materials, ["Зэвэрдэггүй ган"]);
  assert.equal(hints.titles[0], "davga belen gal togoo");
  assert.match(hints.shortDescriptions[0], /L хэлбэр бэлэн гал тогоо/);
  const generic = glb.kitchenGlbListingSuggestions({ widthMm: 3200, depthMm: 620, materialNames: ["*74"], nodeNames: ["3DGeom-1"] });
  assert.equal(generic.cabinetCount, 0);
  assert.equal(generic.layout, "straight");
  assert.deepEqual(generic.inclusions, []);
});

test("GLB size limits reject wrong units and oversized files", () => {
  const good = { widthMm: 3000, depthMm: 600, heightMm: 2400, bytes: 1e6, triangles: 1e5 };
  assert.deepEqual(glb.kitchenGlbIssues(good), []);
  assert.equal(glb.kitchenGlbIssues({ ...good, widthMm: 3 }).length, 1);
  assert.equal(glb.kitchenGlbIssues({ ...good, heightMm: 24000 }).length, 1);
  assert.equal(glb.kitchenGlbIssues({ ...good, bytes: 41 * 1024 * 1024, triangles: 4e6 }).length, 2);
});

test("GLB drafts need an upload id, a layout and a module count", () => {
  const draft = marketplace.parseKitchenMarketplaceGlbDraft({
    modelUploadId: id,
    layout: "l-right",
    cabinetCount: "12",
    title: "Davga kitchen",
    pricingMode: "quote",
  });
  assert.equal(draft.modelUploadId, id);
  assert.equal(draft.payload.layout, "l-right");
  assert.equal(draft.payload.cabinetCount, 12);
  assert.match(draft.slug, /^davga-kitchen-[0-9a-f]{8}$/);
  for (const change of [{ modelUploadId: "nope" }, { layout: "u" }, { cabinetCount: null }, { cabinetCount: 81 }])
    assert.throws(
      () => marketplace.parseKitchenMarketplaceGlbDraft({ modelUploadId: id, layout: "straight", cabinetCount: 4, title: "Davga kitchen", ...change }),
      marketplace.KitchenMarketplaceInputError,
    );
  const replacement = marketplace.parseKitchenGlbReplacement({ versionId: id, modelUploadId: id });
  assert.equal(replacement.layout, null);
  assert.equal(replacement.cabinetCount, null);
});

test("GLB designs are created, replaced and re-versioned only by service-role RPCs", () => {
  const sql = readFileSync("supabase/migrations/20261030150000_kitchen_glb_designs.sql", "utf8");
  for (const name of ["create_kitchen_marketplace_glb_design(uuid,text,jsonb,jsonb)", "replace_kitchen_marketplace_glb(uuid,uuid,uuid,jsonb,jsonb)", "save_kitchen_marketplace_version(uuid,uuid,uuid,text,jsonb)"]) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${name.replace(/[()]/g, "\\$&")} from public,anon,authenticated`));
    assert.match(sql, new RegExp(`grant execute on function public\\.${name.replace(/[()]/g, "\\$&")} to service_role`));
  }
  // The model path is bound to the acting merchant's own upload prefix.
  assert.match(sql, /kitchen-designs\/'\|\|p_actor::text\|\|'\/\[0-9a-f-\]\{36\}\\\.glb\$/);
  assert.match(sql, /set_config\('app\.kitchen_actor',p_actor::text,true\)/);
  assert.match(sql, /source_garniture_id is null and p_mode='new_version'/);
});

test("shop pages offer 3D/AR for GLB designs and hide the planner hand-off", () => {
  const page = readFileSync("src/components/pages/KitchenPageClient.tsx", "utf8");
  assert.match(page, /<KitchenDesignStage[\s\S]*model=\{design\.model\}/);
  const stage = readFileSync("src/components/KitchenDesignStage.tsx", "utf8");
  assert.match(stage, /"ar-modes", "webxr scene-viewer quick-look"/);
  const route = readFileSync("src/app/api/kitchen-designs/[id]/model/[file]/route.ts", "utf8");
  assert.match(route, /design\.publication_status === "published" &&\s*design\.published_version_id === versionId/);
});

/** Loose 18 mm boards of a 3-unit base run + 2 wall units, like a SketchUp export. */
function boardKitchen() {
  let id = 0;
  const board = (name, min, max, materials = ["*74"]) => ({ id: id++, name, materials, box: { min, max } });
  return [
    board("back", [-900, 0, -300], [900, 820, -282]),
    board("side-l", [-900, 0, -282], [-882, 820, 300]),
    board("side-r", [882, 0, -282], [900, 820, 300]),
    board("rail", [-882, 720, 282], [882, 820, 300]),
    board("door-1", [-882, 100, 282], [-282, 790, 300]),
    board("door-2", [-282, 100, 282], [318, 790, 300]),
    board("drawer-a", [318, 100, 282], [882, 330, 300]),
    board("drawer-b", [318, 340, 282], [882, 560, 300]),
    board("drawer-c", [318, 570, 282], [882, 790, 300]),
    board("worktop", [-900, 820, -300], [900, 850, 300], ["*64"]),
    board("splash", [-900, 850, -300], [900, 1450, -285], ["*64"]),
    board("upper-1", [-900, 1450, 2], [-300, 2170, 20], ["*76"]),
    board("upper-2", [-300, 1450, 2], [300, 2170, 20], ["*76"]),
    board("upper-side-a", [298, 1450, -300], [316, 2170, 20], ["*76"]),
    board("upper-side-b", [316, 1450, -300], [334, 2170, 20], ["*76"]),
    board("Kitchen Sink", [-250, 700, -100], [250, 860, 200], ["Kitchen Sink"]),
  ];
}

test("fronts in one plane become modules; side boards, rails and backs do not", () => {
  const parts = boardKitchen();
  const detection = modules.detectKitchenGlbModules(parts);
  assert.deepEqual(
    detection.modules.map((item) => [item.role, item.widthMm, item.parts.length]),
    [["base", 600, 1], ["base", 600, 1], ["base", 564, 3], ["wall", 600, 1], ["wall", 600, 1]],
  );
  assert.equal(detection.fronts, 7);
  assert.equal(detection.countertopM2, 1.08);
  assert.equal(detection.backsplashM2, 1.08);
  const colored = modules.kitchenGlbAssignMaterials(detection, parts, {
    "*74": { color: "#7a5a3a", roughness: 0.6, metalness: 0, textured: true },
    "*76": { color: "#f2f0ea", roughness: 0.2, metalness: 0, textured: false },
    "*64": { color: "#ece9e2", roughness: 0.3, metalness: 0, textured: false },
  });
  assert.deepEqual(colored.modules.map((item) => item.finish), ["wood", "wood", "wood", "gloss", "gloss"]);
  assert.equal(colored.countertopColor, "#ece9e2");
});

test("confirmed modules become separate planner cabinets the planner accepts", () => {
  const { parseKitchen } = loadSource("src/lib/kitchenAssembly.ts");
  const parts = boardKitchen();
  const detection = modules.detectKitchenGlbModules(parts);
  const planner = modules.kitchenGlbPlannerKitchen(detection.modules, parts, {
    heightMm: 2700,
    countertopColor: "#ece9e2",
    appliances: detection.appliances,
  });
  const kitchen = parseKitchen(JSON.parse(JSON.stringify(planner)));
  assert.equal(kitchen.cabinets.length, 5);
  assert.deepEqual(kitchen.cabinets.map((item) => item.type), ["base", "base", "base", "wall", "wall"]);
  // Units face +Z with their backs on the z = 0 wall; the sink lands in a 600 mm box.
  assert.ok(kitchen.cabinets.every((item) => item.position.rotation === 0));
  assert.equal(kitchen.cabinets[0].position.z, kitchen.cabinets[0].depth / 2);
  assert.equal(kitchen.cabinets[1].opening, "sink");
  assert.equal(kitchen.cabinets[2].opening, "drawers");
  assert.equal(kitchen.countertop.color, "#ece9e2");
  // A manual module from a clicked board is added on top of the detection.
  const manual = modules.kitchenGlbManualModule(parts[1], parts, "u1");
  assert.equal(manual.manual, true);
  assert.equal(manual.role, "base");
});

test("planner copies are stored in the GLB snapshot so open-in-planner clones them", () => {
  const sql = readFileSync("supabase/migrations/20261030170000_kitchen_glb_planner.sql", "utf8");
  assert.match(sql, /kitchen_glb_snapshot\(p_model,layout_name,p_payload->'planner'\)/g);
  assert.match(sql, /'plannerReady',true/);
  const server = readFileSync("src/lib/kitchenGlbPlannerServer.ts", "utf8");
  assert.match(server, /parseKitchen\(value\)/);
  const page = readFileSync("src/components/pages/KitchenPageClient.tsx", "utf8");
  assert.match(page, /design\.plannerReady && \(\s*<UseKitchenDesignButton/);
});

/** Two 600 mm base carcasses side by side (own sides back to back), each with a door. */
function twoCarcasses() {
  let id = 0;
  const board = (name, min, max) => ({ id: id++, name, materials: [], box: { min, max } });
  const cabinet = (x) => [
    board(`side-l@${x}`, [x, 0, 0], [x + 18, 820, 560]),
    board(`side-r@${x}`, [x + 582, 0, 0], [x + 600, 820, 560]),
    board(`bottom@${x}`, [x + 18, 100, 0], [x + 582, 118, 560]),
    board(`top@${x}`, [x + 18, 802, 0], [x + 582, 820, 560]),
    board(`back@${x}`, [x + 18, 100, 0], [x + 582, 802, 5]),
    board(`door@${x}`, [x + 2, 100, 562], [x + 598, 798, 580]),
  ];
  return [...cabinet(0), ...cabinet(600)];
}

test("a clicked side board grows into its whole carcass, never into the neighbour", () => {
  const carcass = loadSource("src/lib/kitchenGlbCarcass.ts");
  const parts = twoCarcasses();
  for (const seed of [parts[1], parts[3], parts[5]]) {
    const grown = carcass.kitchenGlbGrowCabinet(seed, parts);
    assert.ok(grown, seed.name);
    assert.deepEqual(grown.parts.slice().sort((a, b) => a - b), [0, 1, 2, 3, 4, 5], seed.name);
    assert.deepEqual([grown.box.min[0], grown.box.max[0]], [0, 600]);
  }
  const manual = modules.kitchenGlbManualModule(parts[7], parts, "u1");
  assert.equal(manual.widthMm, 600);
  assert.equal(manual.role, "base");
  assert.equal(manual.parts.length, 6);
});

test("appliances are counted once each, by name or by size", () => {
  const carcass = loadSource("src/lib/kitchenGlbCarcass.ts");
  let id = 0;
  const part = (name, min, max, materials = []) => ({ id: id++, name, materials, box: { min, max } });
  const parts = [
    part("", [0, 0, 0], [600, 2500, 600]), // tall housing (not an appliance)
    part("", [2, 820, 10], [598, 1415, 590]), // oven body
    part("glass", [2, 820, 590], [598, 1415, 600], ["OVEN INTEGRA"]), // its named front
    part("", [0, 1450, 100], [600, 1845, 540]), // microwave above it
    part("", [700, 0, 0], [1610, 1780, 610]), // fridge
    part("", [2000, 1550, 0], [2600, 1600, 500]), // hood canopy
    part("hob", [2000, 850, 0], [2580, 856, 500], ["Fagor Induction plus"]),
  ];
  const found = carcass.detectKitchenGlbAppliances(parts, 850);
  assert.deepEqual(
    carcass.kitchenGlbApplianceLines(found),
    ["Плитка · 1 ш", "Утаа сорогч · 1 ш", "Шарах шүүгээ · 1 ш", "Богино долгионы зуух · 1 ш", "Хөргөгч · 1 ш"],
  );
  const oven = found.find((item) => item.kind === "oven");
  assert.deepEqual(oven.parts.slice().sort(), [1, 2]);
});

test("front-detected modules are re-measured on their carcass for the factory", () => {
  const checks = loadSource("src/lib/kitchenGlbChecks.ts");
  const parts = twoCarcasses();
  const detection = modules.detectKitchenGlbModules(parts);
  assert.deepEqual(detection.modules.map((item) => item.widthMm), [596, 596]);
  const measured = checks.kitchenGlbMeasureModules(detection, parts);
  assert.deepEqual(
    measured.modules.map((item) => [item.widthMm, item.heightMm, item.depthMm, item.measured.depth]),
    [[600, 820, 560, "carcass"], [600, 820, 560, "carcass"]],
  );
  assert.equal(measured.modules[0].parts.length, 6);
  // Every board now belongs to a module: nothing is reported as loose.
  assert.equal(checks.kitchenGlbLooseBoards(measured, parts).length, 0);
  // Fronts alone leave the depth a guess, which must be raised as an error.
  const guessed = checks.kitchenGlbModuleIssues(detection, parts);
  assert.equal(guessed.length > 0, true);
  const unmeasured = checks.kitchenGlbModuleIssues(
    { ...detection, modules: detection.modules.map((item) => ({ ...item, measured: { width: "front", height: "front", depth: "estimated" } })) },
    parts,
  );
  assert.ok(unmeasured.some((item) => item.level === "error" && /таамагласан/.test(item.text)));
  // A checked module keeps only impossible-size errors.
  const confirmed = checks.kitchenGlbModuleIssues(measured, parts);
  assert.ok(!confirmed.some((item) => /таамагласан|нүүрээр/.test(item.text)));
});

test("several modules and loose parts merge into one cabinet to re-check", () => {
  const checks = loadSource("src/lib/kitchenGlbChecks.ts");
  const parts = twoCarcasses();
  const detection = checks.kitchenGlbMeasureModules(modules.detectKitchenGlbModules(parts), parts);
  const merged = checks.kitchenGlbMergeModules(detection.modules, ["m1", "m2"], [], parts, "u1");
  assert.equal(merged.length, 1);
  assert.equal(merged[0].widthMm, 1200);
  assert.equal(merged[0].parts.length, 12);
  assert.equal(merged[0].measured.width, "merged");
  assert.equal(merged[0].manual, true);
});

test("bent panels are told apart by shell thickness and listed with their developed length", () => {
  const checks = loadSource("src/lib/kitchenGlbChecks.ts");
  // A quarter-round 18 mm end panel: its box is 400 × 900 × 400, its shell is thin.
  const bent = { id: 0, name: "round end", materials: [], box: { min: [0, 0, 0], max: [400, 900, 400] }, thicknessMm: 18, areaMm2: 2 * 900 * 628 };
  assert.equal(modules.kitchenGlbCurved(bent), true);
  const detection = modules.detectKitchenGlbModules([bent]);
  assert.equal(detection.modules.length, 0, "a bent panel is not a solid cabinet");
  const rows = checks.kitchenGlbBom(detection, [bent]);
  assert.match(rows[0].note, /дэлгэсэн урт ≈ 628 мм/);
  assert.equal(checks.kitchenGlbPartCategories(detection, [bent]).get(0), "curved");
  assert.ok(checks.kitchenGlbModuleIssues(detection, [bent]).some((item) => /муруй/.test(item.text)));
});

test("detected modules become one-click composition lines with exact sizes", () => {
  const checks = loadSource("src/lib/kitchenGlbChecks.ts");
  const parts = twoCarcasses();
  const detection = checks.kitchenGlbMeasureModules(modules.detectKitchenGlbModules(parts), parts);
  assert.deepEqual(checks.kitchenGlbModuleLines(detection.modules), ["Доод шүүгээ 600 × 820 × 560 мм · 2 ш"]);
  const hints = glb.kitchenGlbListingSuggestions({ widthMm: 1200, depthMm: 580, materialNames: [], nodeNames: [] }, "", "modern", detection);
  assert.ok(hints.inclusions.includes("Доод шүүгээ 600 × 820 × 560 мм · 2 ш"));
});
