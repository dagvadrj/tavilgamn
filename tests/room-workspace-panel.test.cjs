const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");

const h = React.createElement;
const image = { default: (props) => h("img", { src: props.src, alt: props.alt }) };
// Server rendering reads a zustand store's initial state, so tests pass state through selectors.
const store = (state) => Object.assign((select) => select(state), { getState: () => state, setState() {} });
const link = { PlannerLink: (props) => h("a", { href: props.href, className: props.className }, props.children) };

test("workspace panel: three tabs in list view, Буцах in nested views, label-carrying open button when closed", () => {
  const { RoomWorkspacePanel } = loadSource("src/features/room-planner/components/RoomWorkspacePanel.tsx");
  const base = { onOpenChange() {}, onTab() {}, onBack() {}, meta: { add: "Каталог", added: "3 өрөөнд", cart: "2 ширхэг" }, children: h("p", null, "content") };
  const list = renderToStaticMarkup(h(RoomWorkspacePanel, { ...base, open: true, tab: "added", view: "list" }));
  assert.equal((list.match(/role="tab"/g) ?? []).length, 3);
  assert.match(list, /aria-selected="true"[^>]*>.*?Нэмсэн тавилга<\/span><small>3 өрөөнд/);
  assert.match(list, /Сагсалсан тавилга<\/span><small>2 ширхэг/);
  assert.match(list, /aria-label="Самбар хаах — камер хэвээр үлдэнэ"/);
  assert.doesNotMatch(list, /Буцах/);
  const nested = renderToStaticMarkup(h(RoomWorkspacePanel, { ...base, open: true, tab: "added", view: "detail", nestedEyebrow: "Засах", nestedTitle: "Луна #2" }));
  assert.doesNotMatch(nested, /role="tablist"/);
  assert.match(nested, /Буцах/);
  assert.match(nested, /Луна #2/);
  const closed = renderToStaticMarkup(h(RoomWorkspacePanel, { ...base, open: false, tab: "cart", view: "detail" }));
  assert.match(closed, /aria-label="Самбар нээх · Сагсалсан тавилга"/);
  assert.doesNotMatch(closed, /content/, "a closed panel renders no content");
});

test("added rows number instances, show cart quantity per variant and expand actions only for the selection", () => {
  const useCart = store({ items: [{ id: "c1", productId: "sofa", name: "Луна", image: "", color: "grey", material: "fabric", unitPrice: 100, qty: 2 }] });
  const useRoomModelStatus = store({ byInstance: { a: "ready", b: "loading" } });
  const { RoomAddedList } = loadSource("src/features/room-planner/components/RoomAddedList.tsx", {
    "next/image": image, "@/store/cart": { useCart }, "@/store/roomModelStatus": { useRoomModelStatus },
  });
  const row = (instanceId, number, color) => ({ instanceId, productId: "sofa", color, material: "fabric", name: "Луна", number, image: null, meta: "200 × 90 × 80 см", price: "100₮", has3d: true, purchasable: true });
  const noop = () => {};
  const html = renderToStaticMarkup(h(RoomAddedList, {
    rows: [row("a", 1, "grey"), row("b", 2, "blue")], selected: "b", room: "Зочны өрөө", summary: "2 тавилга",
    onRoom: noop, onSelect: noop, onFocus: noop, onDuplicate: noop, onRemove: noop, onEdit: noop, onAddFurniture: noop,
  }));
  assert.match(html, /Луна <small>#1<\/small>/);
  assert.match(html, /Луна <small>#2<\/small>/);
  assert.match(html, /Сагсанд 2/, "the grey variant is in the cart twice");
  assert.match(html, /Сагсанд ороогүй/, "the blue variant is a different cart line");
  assert.match(html, /Бэлэн/);
  assert.match(html, /Ачаалж байна/);
  assert.equal((html.match(/> Төвлөрүүлэх<\/button>/g) ?? []).length, 1, "only the selected row expands its actions");
  assert.match(html, /aria-pressed="true"/);
  const empty = renderToStaticMarkup(h(RoomAddedList, { rows: [], selected: null, room: "", summary: "", onRoom: noop, onSelect: noop, onFocus: noop, onDuplicate: noop, onRemove: noop, onEdit: noop, onAddFurniture: noop }));
  assert.match(empty, /Өрөө хоосон байна/);
});

test("cart tab is the purchase list: stepper floor of one, placed count, no-3D items cannot be placed", () => {
  const useCart = store({ setQty() {}, remove() {}, items: [
    { id: "c1", productId: "sofa", name: "Луна", image: "", color: "grey", material: "fabric", unitPrice: 100, qty: 1 },
    { id: "c2", productId: "lamp", name: "Гэрэл", image: "", color: "black", material: "metal", unitPrice: 50, qty: 3 },
  ] });
  const products = { sofa: { id: "sofa", model: { id: "m", file: "s.glb" }, storeIds: ["s1"], colors: [{ id: "grey", name: "Саарал" }], materials: [{ id: "fabric", name: "Даавуу" }] },
    lamp: { id: "lamp", storeIds: [], colors: [], materials: [] } };
  const { RoomCartList, RoomCartFooter } = loadSource("src/features/room-planner/components/RoomCartList.tsx", {
    "next/image": image, "@/components/PlannerLink": link, "@/store/cart": { useCart }, "@/store/catalog": { getProduct: (id) => products[id] },
  });
  const html = renderToStaticMarkup(h(RoomCartList, { storeNames: new Map([["s1", "Гэр Тавилга"]]), placedCount: (item) => (item.productId === "sofa" ? 2 : 0), onPlace() {}, onRemoved() {}, onBrowse() {} }));
  assert.match(html, /Гэр Тавилга/);
  assert.match(html, /Саарал · Даавуу/);
  assert.match(html, /aria-label="Нэгээр хасах" disabled=""/, "quantity one cannot go lower");
  assert.match(html, /Өрөөнд 2 байрлуулсан/);
  assert.match(html, /3D загваргүй тул өрөөнд харагдахгүй\. Захиалгад нөлөөлөхгүй\./);
  assert.equal((html.match(/disabled="">Өрөөнд байрлуулах/g) ?? []).length, 1, "only the photo-only lamp is blocked");
  const footer = renderToStaticMarkup(h(RoomCartFooter));
  assert.match(footer, /2 төрөл · 4 ширхэг/);
  assert.match(footer, /href="\/cart"/);
  assert.match(footer, /href="\/checkout"/);
});

test("model status: first load, variant swap keeps the old model, retry remounts and clears on removal", () => {
  const { useRoomModelStatus, modelBusy } = loadSource("src/store/roomModelStatus.ts");
  const s = () => useRoomModelStatus.getState();
  s().begin("p"); assert.equal(s().byInstance.p, "loading");
  s().set("p", "ready"); s().begin("p"); assert.equal(s().byInstance.p, "swapping", "a rendered model stays while the new variant loads");
  assert.equal(modelBusy("swapping"), true); assert.equal(modelBusy("ready"), false);
  s().set("p", "error"); s().retry("p"); s().retry("p");
  assert.equal(s().byInstance.p, "loading"); assert.equal(s().attempts.p, 2);
  s().clear("p"); assert.equal(s().byInstance.p, undefined); assert.equal(s().attempts.p, undefined);
});

test("row states: failed rows offer retry and removal, swapping is labelled, an empty room offers templates", () => {
  const useCart = store({ items: [] });
  const useRoomModelStatus = store({ byInstance: { a: "error", b: "swapping", c: "loading" }, attempts: {} });
  const { RoomAddedList } = loadSource("src/features/room-planner/components/RoomAddedList.tsx", {
    "next/image": image, "@/store/cart": { useCart }, "@/store/roomModelStatus": { useRoomModelStatus },
  });
  const row = (instanceId, number) => ({ instanceId, productId: "sofa", color: "grey", material: "fabric", name: "Луна", number, image: null, meta: "", price: "", has3d: true, purchasable: true });
  const noop = () => {};
  const props = { selected: null, room: "", summary: "", onRoom: noop, onSelect: noop, onFocus: noop, onDuplicate: noop, onRemove: noop, onEdit: noop, onAddFurniture: noop, onTemplates: noop };
  const html = renderToStaticMarkup(h(RoomAddedList, { ...props, rows: [row("a", 1), row("b", 2), row("c", 3)] }));
  assert.match(html, /role="alert"><span>Загвар ачаалагдсангүй\. Байрлал хадгалагдсан\.<\/span>/);
  assert.match(html, />Дахин оролдох</); assert.match(html, />Өрөөнөөс хасах</);
  assert.match(html, /Хувилбар солиж байна/);
  assert.equal((html.match(/room-added-progress/g) ?? []).length, 1, "only the first load shows progress");
  const empty = renderToStaticMarkup(h(RoomAddedList, { ...props, rows: [] }));
  assert.match(empty, /Тавилга нэмэх/); assert.match(empty, /Бэлэн өрөө/);
});

test("empty cart offers to buy the room only when the room has furniture", () => {
  const useCart = store({ items: [], setQty() {}, remove() {} });
  const { RoomCartList } = loadSource("src/features/room-planner/components/RoomCartList.tsx", {
    "next/image": image, "@/components/PlannerLink": link, "@/store/cart": { useCart }, "@/store/catalog": { getProduct: () => undefined },
  });
  const props = { storeNames: new Map(), placedCount: () => 0, onPlace() {}, onRemoved() {}, onBrowse() {}, onBuyRoom() {} };
  assert.match(renderToStaticMarkup(h(RoomCartList, { ...props, roomPieceCount: 3 })), /Өрөөний 3 тавилгыг сагслах/);
  const none = renderToStaticMarkup(h(RoomCartList, { ...props, roomPieceCount: 0 }));
  assert.match(none, /Каталог үзэх/); assert.doesNotMatch(none, /сагслах</);
});

test("catalog states: skeleton is busy, errors stay local, no-search-results and empty assortment differ", () => {
  const { RoomCatalogSkeleton, RoomCatalogError, RoomCatalogEmpty } = loadSource("src/features/room-planner/components/RoomCatalogStates.tsx");
  const skeleton = renderToStaticMarkup(h(RoomCatalogSkeleton));
  assert.match(skeleton, /aria-busy="true"/); assert.equal((skeleton.match(/room-skeleton-card/g) ?? []).length, 4);
  const error = renderToStaticMarkup(h(RoomCatalogError, { message: "Сүлжээ тасарсан.", onRetry() {} }));
  assert.match(error, /role="alert"/);
  assert.match(renderToStaticMarkup(h(RoomCatalogError, { message: "Failed to fetch", onRetry() {} })), /Сүлжээний холболтоо шалгаад/, "raw browser errors are not shown"); assert.match(error, /Дахин оролдох/); assert.match(error, /сагс хэвийн ажилласаар/);
  const noop = () => {};
  const base = { onAllCategories: noop, onClearQuery: noop, onAllStores: noop, onReset: noop };
  const search = renderToStaticMarkup(h(RoomCatalogEmpty, { ...base, query: "ширээ", category: "Буйдан", elsewhere: 4, scope: null, merchant: null }));
  assert.match(search, /«ширээ» олдсонгүй/); assert.match(search, /Бусад ангилалд 4 илэрц/);
  assert.match(search, /Бүх ангилалд харах/); assert.match(search, /Хайлт арилгах/); assert.doesNotMatch(search, /Бүх дэлгүүрээс/);
  const assortment = renderToStaticMarkup(h(RoomCatalogEmpty, { ...base, query: "", category: null, elsewhere: 0, scope: "Унтлагын өрөө", merchant: "Гэр Тавилга" }));
  assert.match(assortment, /Унтлагын өрөө · Гэр Тавилга-д 3D бараа алга/); assert.match(assortment, /Бүх дэлгүүрээс харах/);
  assert.doesNotMatch(assortment, /олдсонгүй/);
});

test("save chip names the four states and only a failure offers a retry", () => {
  const { roomSaveChip } = loadSource("src/lib/roomSaveStatus.ts");
  assert.deepEqual(roomSaveChip("checking"), { tone: "saving", label: "Хадгалж байна…", retry: false });
  assert.deepEqual(roomSaveChip("error"), { tone: "error", label: "Хадгалж чадсангүй", retry: true });
  for (const kind of ["draft", "modified"]) assert.equal(roomSaveChip(kind).label, "Хадгалаагүй өөрчлөлт");
  const saved = roomSaveChip("saved", new Date(2026, 9, 28, 14, 5).getTime());
  assert.equal(saved.tone, "saved"); assert.equal(saved.label, "Хадгалсан · 14:05");
  assert.equal(roomSaveChip("saved").label, "Хадгалсан");
});

test("phone sheet: closed is a peek with tabs and a summary line, open is half height without a backdrop", () => {
  const { RoomWorkspacePanel } = loadSource("src/features/room-planner/components/RoomWorkspacePanel.tsx", {
    react: { ...React, useSyncExternalStore: () => true },
  });
  const base = { onOpenChange() {}, onTab() {}, onBack() {}, meta: { add: "Каталог", added: "3 өрөөнд", cart: "2 ширхэг" },
    peekLine: "3 тавилга өрөөнд · ₮1,200 · сагсанд 2 ш", footer: h("p", null, "footer"), children: h("p", null, "content") };
  const peek = renderToStaticMarkup(h(RoomWorkspacePanel, { ...base, open: false, tab: "add", view: "list" }));
  assert.match(peek, /data-sheet="peek"/);
  assert.match(peek, /class="room-sheet-grabber" aria-label="Самбарыг томруулах" aria-expanded="false"/);
  assert.equal((peek.match(/role="tab"/g) ?? []).length, 3, "the same three tabs stay reachable on the peek");
  assert.match(peek, /3 тавилга өрөөнд · ₮1,200 · сагсанд 2 ш/);
  assert.doesNotMatch(peek, /content|footer|room-panel-open-button|room-panel-backdrop/);
  const half = renderToStaticMarkup(h(RoomWorkspacePanel, { ...base, open: true, tab: "add", view: "list" }));
  assert.match(half, /data-sheet="half"/);
  assert.match(half, /aria-expanded="true"/);
  assert.match(half, /content/);
  assert.match(half, /footer/);
  assert.doesNotMatch(half, /room-panel-backdrop/, "the scene above the sheet stays usable");
  assert.doesNotMatch(half, /room-sheet-peek/);
});

test("Escape shortcut goes down one level per press", () => {
  const source = require("node:fs").readFileSync(require("node:path").join(__dirname, "../src/components/RoomPlanner.tsx"), "utf8");
  const body = source.slice(source.indexOf("    escape: () => {"), source.indexOf("  const exportImage"));
  const order = ["setSummaryOpen(false)", "closeNested()", "setSelected(null)", 'navigateView("fit")', "setLeftOpen(false)"].map((call) => body.indexOf(call));
  assert.ok(order.every((index) => index > 0), "every level is handled");
  assert.deepEqual([...order].sort((a, b) => a - b), order, "summary → nested view → selection → interior → panel");
  assert.equal((body.match(/return;/g) ?? []).length, 4, "each level stops the press");
  assert.match(source, /if \(event\.defaultPrevented\) return;/, "panel and menus handle their own Escape first");
});
