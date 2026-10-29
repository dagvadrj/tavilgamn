const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");

const k = loadSource("src/lib/kitchenWorkspace.ts");
const h = React.createElement;
const nodes = (node) => (!React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)]);
const room = (extra = {}) => ({ width: 4000, depth: 3000, height: 2600, items: [], ...extra });

test("K1 room limits, opening margin and the step lock follow the brief", () => {
  assert.deepEqual(k.kitchenRoomIssues(room()), { fields: {}, openings: {} });
  assert.equal(k.kitchenStepLock(room()), null);
  const bad = k.kitchenRoomIssues(room({ width: 1500, depth: 9000, height: 2100 }));
  assert.match(bad.fields.width, /1800–8000 mm/);
  assert.match(bad.fields.depth, /1500–8000/);
  assert.match(bad.fields.height, /2200–3500/);
  assert.equal(k.kitchenRoomIssues(room({ width: 1800, depth: 1500, height: 3500 })).fields.width, undefined, "limits are inclusive");
  const window = { id: "w", kind: "window", wall: "right", x: 4000, z: 1500, width: 300, depth: 100 };
  assert.match(k.kitchenRoomIssues(room({ items: [window] })).openings.w, /Цонхны өргөн 400–3000/);
  // Wall B is 3000 long: offset 2000 + width 1000 leaves no 100 mm margin.
  const tight = { ...window, width: 1000, z: 2500 };
  assert.equal(k.openingOffset(room(), tight), 2000);
  assert.match(k.kitchenRoomIssues(room({ items: [tight] })).openings.w, /B хана/);
  assert.equal(k.kitchenRoomIssues(room({ items: [{ ...tight, z: 2400 }] })).openings.w, undefined);
  const door = { id: "d", kind: "door", wall: "left", x: 0, z: 1500, width: 1300, depth: 100 };
  assert.match(k.kitchenRoomIssues(room({ items: [door] })).openings.d, /Хаалганы өргөн 600–1200/);
  assert.match(k.kitchenStepLock(room({ width: 1500 })), /1 алдааг засаад/);
  assert.equal(k.kitchenRoomIssues(room({ width: 1500 }), "cm").fields.width, "Өргөн 180–800 cm байна.");
});

test("K1 units: mm stays whole, cm keeps one decimal, bad text is not a number", () => {
  assert.equal(k.toUnit(4005, "cm"), "400.5");
  assert.equal(k.toUnit(4005, "mm"), "4005");
  assert.equal(k.fromUnit("400,5", "cm"), 4005);
  assert.equal(k.fromUnit(" 3 600 ", "mm"), 3600);
  assert.equal(k.fromUnit("", "mm"), null);
  assert.equal(k.fromUnit("abc", "cm"), null);
  assert.deepEqual(k.KITCHEN_WALLS.map((wall) => `${wall.letter}:${wall.side}`), ["A:back", "B:right", "C:front", "D:left"]);
  assert.equal(k.kitchenProjectTitle({ width: 4500, depth: 3600 }), "Гал тогоо · 4.5 × 3.6 м");
});

test("K6 BOM: included parts never priced, null is unknown, 0 is a real zero, no «Үнэгүй»", () => {
  const row = (id, extra) => ({ id, label: id, quantity: 1, unit: "ш", dimensions: "", material: "", unitPrice: null, included: false, ...extra });
  const view = k.presentKitchenBom({
    items: [
      row("c1", { productId: "p1", unitPrice: 300000, quantity: 2 }),
      row("c1/handle", { included: true, unitPrice: 9000 }),
      row("c2", { productId: "p2", unitPrice: 0 }),
      row("c3", {}),
      row("top", { label: "Тавцан 1" }),
    ],
    knownSubtotal: 0, unpricedCount: 0, complete: false,
  });
  assert.equal(view.knownTotal, 600000, "included 9000 is not added");
  assert.deepEqual(view.unpriced.map((r) => r.id), ["c3", "top"]);
  assert.equal(view.includedCount, 1);
  assert.deepEqual(view.rows.map((r) => r.source), ["actual", "included", "actual", "sample", "computed"]);
  assert.equal(view.rows[2].total, 0, "a real zero stays a number");
  assert.equal(view.rows[3].total, null);
  assert.equal(k.bomMoney(null), "Үнэ бүртгэгдээгүй");
  assert.equal(k.bomMoney(0), "₮0");
  assert.ok(![k.bomMoney(null), k.bomMoney(0), ...Object.values(k.BOM_SOURCE_LABEL)].some((text) => /Үнэгүй/i.test(text)));
});

test("K7 form validation and warnings come from the design only", () => {
  const ok = { name: "Болд", phone: "9911 2233", district: "Хан-Уул", slot: "", consent: true };
  assert.deepEqual(k.measureFormErrors(ok), {});
  assert.deepEqual(Object.keys(k.measureFormErrors({ ...ok, name: "", phone: "991122", district: "", consent: false })), ["name", "phone", "district", "consent"]);
  assert.match(k.measureFormErrors({ ...ok, phone: "991122334" }).phone, /8 оронтой/);
  assert.deepEqual(k.handoffWarnings({ room: room(), cabinets: [], unpricedCount: 0 }), []);
  const warnings = k.handoffWarnings({
    room: room({ items: [{ id: "w", kind: "window", wall: "back", x: 2000, z: 0, width: 1200, depth: 100 }] }),
    cabinets: [{ id: "a", type: "base", catalogAdaptation: "sink" }, { id: "b", type: "wall", opening: "hood" }],
    unpricedCount: 2,
  });
  assert.equal(warnings.length, 5);
  assert.ok(warnings.some((text) => /ус\/бохирын цэг тэмдэглэгдээгүй/.test(text)));
});

test("K5 wall elevation: pieces against a wall, measured from inside; free-standing pieces left out", () => {
  const cabinet = (id, x, z, rotation, extra = {}) => ({ id, type: "base", width: 600, depth: 600, height: 840, position: { x, y: 0, z, rotation }, ...extra });
  const cabinets = [
    cabinet("back", 300, 300, 0),
    cabinet("wall", 1300, 175, 0, { type: "wall", depth: 350, height: 740, position: { x: 1300, y: 1420, z: 175, rotation: 0 } }),
    cabinet("front", 3700, 2700, Math.PI),
    cabinet("table", 2000, 1500, 0),
  ];
  const back = k.wallElevation(room(), cabinets, "back");
  assert.deepEqual(back.pieces.map((p) => [p.id, p.start, p.end, p.bottom, p.top]), [["back", 0, 600, 0, 840], ["wall", 1000, 1600, 1420, 2160]]);
  const front = k.wallElevation(room(), cabinets, "front");
  assert.deepEqual(front.pieces.map((p) => [p.id, p.start, p.end]), [["front", 0, 600]], "C is drawn right-to-left as seen from inside");
  assert.ok(![back, front, k.wallElevation(room(), cabinets, "left"), k.wallElevation(room(), cabinets, "right")].some((v) => v.pieces.some((p) => p.id === "table")));
  const withWindow = k.wallElevation(room({ items: [{ id: "w", kind: "window", wall: "back", x: 2000, z: 0, width: 1200, depth: 100, sillHeight: 1000, height: 1200 }] }), [], "back");
  assert.deepEqual(withWindow.openings, [{ id: "w", kind: "window", start: 1400, end: 2600, bottom: 1000, top: 2200 }]);
});

test("K1 header: a locked room says why and keeps steps 2–4 closed; the room step stays open", () => {
  const { KitchenPlannerHeader } = loadSource("src/features/kitchen-planner/components/KitchenPlannerHeader.tsx");
  const visits = [], locked = [];
  const props = { stage: "space", onStage: (s) => visits.push(s), busy: false, canUndo: false, canRedo: false, onUndo() {}, onRedo() {}, loginHref: "/", name: "Draft", onName() {}, utilities: null, lockReason: "Өрөөний 1 алдааг засаад дараагийн алхам руу орно.", onLocked: (r) => locked.push(r), title: "Гал тогоо · 4 × 3 м" };
  const tree = nodes(KitchenPlannerHeader(props));
  const steps = nodes(tree.find((n) => n.type === "nav")).filter((n) => n.type === "button");
  for (const button of steps) button.props.onClick();
  tree.find((n) => n.props.className === "kitchen-toolbar-continue").props.onClick();
  assert.deepEqual(visits, ["space"]);
  assert.equal(locked.length, 4);
  assert.deepEqual(steps.map((b) => b.props["aria-disabled"] ?? false), [false, true, true, true]);
  assert.equal(steps[0].props["aria-current"], "step");
  assert.ok(tree.some((n) => n.props.className === "kitchen-k-eyebrow"));
});

test("K4 material status: earliest snapshot kept, failure only after a change, retry and ready", () => {
  const { useKitchenAppearanceStatus: store, kitchenRetrySubscriber } = loadSource("src/store/kitchenAppearanceStatus.ts");
  const s = () => store.getState();
  s().fail("c1");
  assert.equal(s().byCabinet.c1, undefined, "an initial load error is not a swap");
  s().begin("c1", { frontMaterialId: "white" });
  s().begin("c1", { frontMaterialId: "sage" });
  assert.deepEqual(s().previous.c1, { frontMaterialId: "white" });
  s().fail("c1");
  assert.equal(s().byCabinet.c1, "error");
  const seen = [];
  const off = kitchenRetrySubscriber("c1")((count) => seen.push(count));
  assert.equal(kitchenRetrySubscriber("c1"), kitchenRetrySubscriber("c1"), "stable per cabinet");
  s().retry("c1");
  s().retry("c2");
  off();
  assert.deepEqual(seen, [1]);
  assert.equal(s().byCabinet.c1, "pending");
  s().ready("c1");
  assert.equal(s().byCabinet.c1, undefined);
  assert.equal(s().previous.c1, undefined);
});

test("K7 measure panel: without a provider it validates but never sends or claims to", () => {
  const { KitchenMeasurePanel } = loadSource("src/features/kitchen-planner/components/KitchenHandoff.tsx", {
    "@/components/PlannerLink": { PlannerLink: (props) => h("a", { href: props.href }, props.children) },
  });
  const html = renderToStaticMarkup(h(KitchenMeasurePanel, { quoteRequest: null, conflict: false }));
  assert.match(html, /type="submit" class="kitchen-k-primary" aria-disabled="true"/);
  assert.match(html, /захиалга үүсэхгүй/);
  assert.doesNotMatch(html, /илгээгдлээ|Симуляци дууслаа/);
  const real = renderToStaticMarkup(h(KitchenMeasurePanel, { quoteRequest: h("form", null, "REAL QUOTE"), conflict: false }));
  assert.match(real, /REAL QUOTE/);
  const blocked = renderToStaticMarkup(h(KitchenMeasurePanel, { quoteRequest: h("form", null, "REAL QUOTE"), conflict: true }));
  assert.doesNotMatch(blocked, /REAL QUOTE/, "a version conflict locks the request");
});
