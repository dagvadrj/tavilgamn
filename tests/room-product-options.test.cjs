const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");

const h = React.createElement;
const read = (file) => readFileSync(path.resolve(__dirname, "..", file), "utf8");
const store = (state) => Object.assign((select) => select(state), { getState: () => state, setState() {} });
const image = { default: (props) => h("img", { src: props.src, alt: props.alt }) };
const link = { PlannerLink: (props) => h("a", { href: props.href, className: props.className }, props.children) };

const product = (id, category, extra = {}) => ({
  id, name: id, category, description: "", basePrice: 100000, image: `/${id}.jpg`, images: [],
  colors: [], materials: [], dimensions: { w: 1, d: 1, h: 1 }, rating: 0, reviewCount: 0,
  stockQuantity: 3, model: { id, file: `${id}.glb` }, storeIds: ["s1"], ...extra,
});

test("gallery: primary image first, extras after, without blanks or repeats", () => {
  const { productGallery } = loadSource("src/lib/productGallery.ts");
  assert.deepEqual(productGallery({ image: "/a.jpg", images: ["/b.jpg", "/a.jpg", "", "  ", "/b.jpg", "/c.jpg"] }), ["/a.jpg", "/b.jpg", "/c.jpg"]);
  assert.deepEqual(productGallery({ image: "", images: undefined }), []);
  assert.deepEqual(productGallery({ image: "/a.jpg" }), ["/a.jpg"]);
});

test("pairing: other categories by rule, in stock with a model, merchant scope, honest reason", () => {
  const { complementaryProducts } = loadSource("src/lib/roomProductOptions.ts");
  const sofa = product("sofa-a", "sofa");
  const catalog = [
    sofa,
    product("sofa-b", "sofa"),
    product("table", "coffee-table", { basePrice: 300000 }),
    product("side", "side-table", { basePrice: 90000 }),
    product("side-empty", "side-table", { stockQuantity: 0 }),
    product("side-nomodel", "side-table", { model: undefined }),
    product("arm-other-store", "armchair", { storeIds: ["s2"] }),
    product("bed", "bed"),
  ];
  const ids = (list) => list.map((item) => item.product.id);
  const all = complementaryProducts(sofa, catalog, { roomType: "living" });
  assert.deepEqual(ids(all), ["table", "side", "arm-other-store"], "rule order first, then price");
  assert.ok(all.every((item) => item.product.category !== "sofa"), "same-category items belong to «Солих», never «Хослуулах»");
  assert.match(all[0].reason, /^Буйдан-тай хамт хэрэглэдэг: /);
  assert.deepEqual(ids(complementaryProducts(sofa, catalog, { roomType: "living", storeId: "s1" })), ["table", "side"]);
  assert.deepEqual(complementaryProducts(product("x", "kitchen-cabinet"), catalog, { roomType: "living" }), []);
});

test("toolbar placement: 12px above the bounds, flips below, clamps 8px inside, null off stage", () => {
  const { placeSelectionToolbar } = loadSource("src/lib/roomProductOptions.ts");
  const stage = { width: 900, height: 600 };
  const bar = { width: 400, height: 60 };
  assert.deepEqual(placeSelectionToolbar({ left: 300, top: 300, right: 500, bottom: 420 }, stage, bar), { x: 400, y: 228, side: "above" });
  assert.deepEqual(placeSelectionToolbar({ left: 300, top: 40, right: 500, bottom: 200 }, stage, bar), { x: 400, y: 212, side: "below" });
  assert.equal(placeSelectionToolbar({ left: 0, top: 300, right: 60, bottom: 400 }, stage, bar).x, 208, "left edge clamps to 8px + half the bar");
  assert.equal(placeSelectionToolbar({ left: 860, top: 300, right: 1200, bottom: 400 }, stage, bar).x, 692, "right edge clamps to 8px + half the bar");
  assert.equal(placeSelectionToolbar({ left: 950, top: 100, right: 1100, bottom: 200 }, stage, bar), null);
  assert.equal(placeSelectionToolbar({ left: 100, top: -300, right: 200, bottom: -10 }, stage, bar), null);
  assert.deepEqual(placeSelectionToolbar({ left: 300, top: 20, right: 500, bottom: 580 }, stage, bar), { x: 400, y: 8, side: "above" });
});

function renderOptions(props, wish = []) {
  const { RoomProductOptions } = loadSource("src/features/room-planner/components/RoomProductOptions.tsx", {
    "next/image": image,
    "@/components/PlannerLink": link,
    "@/store/wishlist": { useWishlist: store({ has: (id) => wish.includes(id), toggle() {} }) },
  });
  return renderToStaticMarkup(h(RoomProductOptions, {
    fallback: { name: "Сандал", image: null, dimensions: { w: 0.7, d: 0.8, h: 0.9 }, note: "Оруулсан 3D загвар. Дэлгүүрийн бараа биш тул дэлгэрэнгүй хуудас, сагс байхгүй." },
    instanceLabel: "#2", canWish: true, price: 1598996, colors: [], materials: [], colorId: "", materialId: "",
    onColor() {}, onMaterial() {}, appearanceTracksVariant: false, canBuy: true, onAddToCart() {},
    mode: "replace", onMode() {}, revealRecommendations: 0, replace: h("p", null, "REPLACE"), pair: h("p", null, "PAIR"),
    ...props,
  }));
}

test("options: content order, real rating, delivery terms and an unregistered pickup row", () => {
  const sofa = product("luna", "sofa", {
    name: "Луна буйдан", description: "Гурван хүний буйдан.", images: ["/luna-2.jpg", "/luna.jpg"], rating: 4.6, reviewCount: 12,
    deliveryTerms: "3 хоногт хүргэнэ", colors: [{ id: "grey", name: "Саарал", hex: "#b5b0a6" }],
  });
  const html = renderOptions({ product: sofa, storeName: "Гэр Тавилга", colors: sofa.colors, colorId: "grey" }, ["luna"]);
  const order = ["room-options-gallery", "Буйдан · Гэр Тавилга", "Луна буйдан <small>#2</small>", "Гурван хүний буйдан.", "Хэмжээ", "★|4.6 · 12 сэтгэгдэл",
    "сонгосон хувилбарын үнэ", "Сагсанд нэмэх", "Дэлгэрэнгүй", "Авах боломж", "Хувилбар", "Ижил бүтээгдэхүүнээр солих", "REPLACE"];
  let at = -1;
  for (const marker of order) {
    const index = marker.split("|").map((part) => html.indexOf(part, at + 1)).find((found) => found > at) ?? -1;
    assert.ok(index > at, `${marker} comes after the previous section`);
    at = index;
  }
  assert.match(html, /4\.6 · 12 сэтгэгдэл/);
  assert.match(html, /aria-pressed="true"[^>]*aria-label="Хүслийн жагсаалтаас хасах"/);
  assert.match(html, /Дэлгүүрийн хүргэлтийн нөхцөл: 3 хоногт хүргэнэ · хүргэлтийн үнийн санал биш/);
  assert.match(html, /Очиж авах, дэлгүүрт үзэх мэдээлэл бүртгэгдээгүй\./);
  assert.match(html, /3D загвар үндсэн өнгөөр харагдана/);
  assert.equal((html.match(/aria-label="Зураг \d"/g) ?? []).length, 2, "two distinct images give two thumbnails");
  assert.match(html, /aria-label="Өмнөх зураг"/);
  assert.match(html, /href="\/product\/luna"/);
});

test("options: one image has no arrows; no reviews says so; merchant hides cart and heart; custom models explain", () => {
  const plain = product("shelf", "bookshelf", { name: "Тавиур" });
  const single = renderOptions({ product: plain });
  assert.doesNotMatch(single, /Өмнөх зураг|Дараах зураг|role="tablist" aria-label="Зургууд"/);
  assert.match(single, /Сэтгэгдэл хараахан алга/);
  assert.doesNotMatch(single, /★/);
  const merchant = renderOptions({ product: plain, canWish: false, canBuy: false });
  assert.doesNotMatch(merchant, /Хүслийн жагсаалт|Сагсанд нэмэх/);
  const custom = renderOptions({ product: null, canBuy: false, price: null });
  assert.match(custom, /Оруулсан 3D загвар\. Дэлгүүрийн бараа биш/);
  assert.doesNotMatch(custom, /Хүслийн жагсаалт|Сагсанд нэмэх|Дэлгэрэнгүй|Авах боломж|Үнэлгээ/);
  assert.match(custom, /Зураг алга/);
});

test("toolbar: one instance, real buttons with labels, and presses never reach the scene", () => {
  const { RoomSelectionToolbar } = loadSource("src/features/room-planner/components/RoomSelectionToolbar.tsx", {
    "@/store/selectionAnchor": { useSelectionAnchor: Object.assign(() => null, { getState: () => ({ instanceId: null, rect: null }), subscribe: () => () => {} }) },
  });
  const actions = ["Сагсанд", "Эргүүлэх", "Солих", "Хослуулах", "Хуулбарлах", "Устгах", "Төвлөрүүлэх"].map((label, i) => ({ id: String(i), label, icon: null, run() {}, primary: i === 0 }));
  const html = renderToStaticMarkup(h(RoomSelectionToolbar, { instanceId: "p2", title: "Луна", number: 2, actions, onOpen() {}, onClose() {} }));
  assert.match(html, /role="toolbar" aria-label="Сонгосон тавилга: Луна"/);
  assert.match(html, /data-anchor="off"/, "without a projected anchor the bar docks at the stage top");
  for (const action of actions) assert.match(html, new RegExp(`aria-label="${action.label}"[^>]*><span>${action.label}</span>`));
  assert.match(html, /class="is-primary"[^>]*aria-label="Сагсанд"/);
  const source = read("src/features/room-planner/components/RoomSelectionToolbar.tsx");
  assert.match(source, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
});

test("planner wiring: cart adds quantity only, copy selects the new instance, remove keeps the cart", () => {
  const source = read("src/components/RoomPlanner.tsx");
  const body = (name) => {
    const start = source.indexOf(`const ${name} = `);
    assert.ok(start >= 0, name);
    return source.slice(start, source.indexOf("\n  };\n", start));
  };
  const cart = body("addSelectedToCart");
  assert.match(cart, /addToCart\(/);
  assert.doesNotMatch(cart, /updatePieces|placeNewPiece|placeFurniture/, "«Сагсанд» never adds a copy to the scene");
  assert.match(body("duplicateSelected"), /setSelected\(copy\.instanceId\)/);
  const remove = body("removePiece");
  assert.doesNotMatch(remove, /removeFromCart|useCart|cart\./, "removing from the room leaves the cart");
  assert.match(remove, /label: "Буцаах"/);
  assert.match(source, /id: "cart",[\s\S]{0,120}run: addSelectedToCart/);
  assert.match(source, /if \(!selectedPiece\.attachment \|\| selectedPiece\.attachment\.kind === "floor"\)\s*selectionActions\.push\(\{\s*id: "rotate"/, "wall pieces get no «Эргүүлэх»");
  assert.match(source, /<RoomSelectionToolbar\s+key=\{selectedPiece\.instanceId\}\s+instanceId=\{selectedPiece\.instanceId\}/);
  assert.match(source, /<RoomProductOptions\s+key=\{selectedPiece\.instanceId\}/);
});

test("canvas: blue thin frame plus a floor footprint for floor pieces; never over a failed model", () => {
  const source = read("src/three/RoomCanvas.tsx");
  assert.match(source, /const SELECTION_COLOR = "#075eaa"/);
  assert.match(source, /\{selected && !failed && \(\s*<mesh position=\{\[0, dims\.h \/ 2, 0\]\}>/);
  assert.match(source, /\{selected &&\s*!failed &&\s*\(!piece\.attachment \|\| piece\.attachment\.kind === "floor"\) && \(/);
  assert.match(source, /<planeGeometry args=\{\[dims\.w \+ 0\.06, dims\.d \+ 0\.06\]\} \/>/);
  assert.match(source, /raycast=\{\(\) => null\}/);
  const anchor = read("src/three/SelectionScreenAnchor.tsx");
  assert.match(anchor, /useFrame\(/, "projection only runs on rendered frames");
  assert.match(anchor, /if \(key === last\.current\) return;/, "an unchanged rect writes no store state");
  assert.doesNotMatch(anchor, /setInterval|requestAnimationFrame/);
  assert.equal((anchor.match(/invalidate\(\)/g) ?? []).length, 1, "one frame on selection so the bar anchors, never a loop");
  const frame = anchor.slice(anchor.indexOf("useFrame("), anchor.indexOf("\n  });", anchor.indexOf("useFrame(")));
  assert.doesNotMatch(frame, /invalidate/, "the frame callback never schedules another frame");
});

test("D2 store: the visible product is the revert target until the new model is on screen", () => {
  const { useRoomModelStatus: store } = loadSource("src/store/roomModelStatus.ts");
  const s = () => store.getState();
  const a = { instanceId: "p1", productId: "a", x: 1, z: 2, rotation: 0, color: "grey", material: "fabric" };
  s().set("p1", "ready");
  s().remember(a);
  s().begin("p1");
  assert.equal(s().byInstance.p1, "swapping");
  s().remember({ ...a, productId: "b" });
  assert.equal(s().previous.p1.productId, "a", "A→B→C: A is still on screen, so A stays the target");
  s().swapError("p1");
  assert.equal(s().byInstance.p1, "ready");
  assert.equal(s().swapFailed.p1, true);
  s().retrySwap("p1");
  assert.equal(s().byInstance.p1, "swapping");
  assert.equal(s().swapFailed.p1, undefined);
  assert.equal(s().swapRetries.p1, 1);
  assert.equal(s().previous.p1.productId, "a", "a retry keeps the revert target");
  s().set("p1", "ready");
  assert.equal(s().previous.p1, undefined, "a ready new model forgets the old one");
  s().remember(a); s().forget("p1");
  assert.equal(s().previous.p1, undefined);
  const before = s();
  s().clear("missing");
  assert.equal(s(), before, "clearing an unknown piece is a no-op");
});

test("D2 panel: loading keeps the old model, failure offers retry and revert, swatches carry the surcharge", () => {
  const state = { byInstance: {}, swapFailed: {}, previous: {}, retrySwap() {} };
  const mod = loadSource("src/features/room-planner/components/RoomProductOptions.tsx", {
    "next/image": image,
    "@/components/PlannerLink": link,
    "@/store/wishlist": { useWishlist: store({ has: () => false, toggle() {} }) },
    "@/store/roomModelStatus": { useRoomModelStatus: store(state) },
  });
  const status = () => renderToStaticMarkup(h(mod.RoomVariantStatus, { instanceId: "p1", name: "Талст буйдан", onRevert() {} }));
  assert.equal(status(), "");
  state.byInstance = { p1: "swapping" };
  assert.match(status(), /role="status"[^>]*>Талст буйдан ачаалж байна — өмнөх загвар харагдсаар/);
  state.byInstance = { p1: "ready" }; state.swapFailed = { p1: true };
  assert.match(status(), /role="alert"[\s\S]*Шинэ хувилбар ачаалагдсангүй — өмнөх загвар хэвээр[\s\S]*Дахин оролдох/);
  assert.doesNotMatch(status(), /Буцаах/, "nothing to revert to without a snapshot");
  state.previous = { p1: { instanceId: "p1" } };
  assert.match(status(), /Буцаах/);
  assert.equal(mod.swatchLabel({ name: "Хөх хилэн", priceDelta: 120000 }), `Хөх хилэн (+${loadSource("src/lib/format.ts").formatPrice(120000)})`);
  assert.equal(mod.swatchLabel({ name: "Саарал" }), "Саарал");
});

test("D2 wiring: price, cart payload and swatch share one variant; replace remembers, revert validates", () => {
  const source = read("src/components/RoomPlanner.tsx");
  assert.match(source, /price=\{\s*selectedPiece\.kitchen \|\| selectedDetails\.basePrice <= 0\s*\? null\s*: getPiecePrice\(selectedPiece\)\s*\}/);
  const cart = source.slice(source.indexOf("const addSelectedToCart = "), source.indexOf("const measurements ="));
  assert.match(cart, /color: selectedPiece\.color,\s*material: selectedPiece\.material,\s*unitPrice: getPiecePrice\(selectedPiece\)/);
  assert.match(source, /onReplace=\{\(pieces\) => \{[\s\S]{0,200}useRoomModelStatus\.getState\(\)\.remember\(selectedPiece\);\s*updatePieces\(pieces\);/);
  const revert = source.slice(source.indexOf("const revertSwap = "), source.indexOf("const openOptions = "));
  assert.match(revert, /isPlacementValid\(candidate, placement\.pieces, placement\.room\)/);
  assert.match(revert, /x: piece\.x,\s*z: piece\.z,\s*rotation: piece\.rotation/);
  const options = read("src/features/room-planner/components/RoomProductOptions.tsx");
  assert.match(options, /Өнгө солиход сагсанд байгаа бараа өөрчлөгдөхгүй\./);
  assert.match(read("src/three/FurnitureLoadState.tsx"), /export const SWAP_DIM_OPACITY = 0\.55;/);
});

test("D3 replace cards: 3D-ready, stock and fit each give an honest reason; imported models get none", () => {
  const { alternativeFit, RoomProductAlternatives } = loadSource("src/features/room-planner/components/RoomProductAlternatives.tsx", {
    "next/image": image,
    "@/lib/roomProductReplacement": {
      replaceRoomProduct: (piece, p) => (p.id === "wide" ? { pieces: null, error: "Шинэ хэмжээ энэ байрлалд багтахгүй." } : { pieces: [{ ...piece, productId: p.id }], error: null }),
    },
  });
  const piece = { instanceId: "p1", productId: "sofa-a", x: 0, z: 0, rotation: 0, color: "c", material: "m", details: { name: "A", dimensions: { w: 2, d: 1, h: 1 }, category: "sofa" } };
  const args = [[piece], { id: "r" }, "r", { room: {}, pieces: [piece] }];
  assert.deepEqual(alternativeFit(piece, product("x", "sofa", { model: undefined }), ...args), { kind: "no-model" });
  assert.deepEqual(alternativeFit(piece, product("x", "sofa", { stockQuantity: 0 }), ...args), { kind: "no-stock" });
  assert.deepEqual(alternativeFit(piece, product("wide", "sofa"), ...args), { kind: "blocked", reason: "Шинэ хэмжээ энэ байрлалд багтахгүй." });
  assert.deepEqual(alternativeFit(piece, product("ok", "sofa"), ...args), { kind: "fits" });
  const catalog = [product("ok", "sofa"), product("wide", "sofa"), product("nomodel", "sofa", { model: undefined }), product("empty", "sofa", { stockQuantity: 0 }), product("chair", "armchair")];
  const html = renderToStaticMarkup(h(RoomProductAlternatives, { piece, product: null, products: catalog, pieces: [piece], room: { id: "r" }, roomId: "r", context: { room: {}, pieces: [piece] }, onReplace() {}, onNotice() {} }));
  assert.match(html, /1 бүтээгдэхүүн энэ байрлалд багтана/);
  assert.match(html, /Багтахгүй — Шинэ хэмжээ/);
  assert.match(html, /3D бэлэн биш/);
  assert.match(html, /Нөөц дууссан/);
  assert.equal((html.match(/Үүгээр солих/g) ?? []).length, 1, "only a fitting card can be chosen");
  assert.doesNotMatch(html, />chair</, "another category never appears");
  const imported = renderToStaticMarkup(h(RoomProductAlternatives, { piece: { ...piece, details: { ...piece.details, category: undefined } }, product: null, products: catalog, pieces: [piece], room: {}, roomId: "r", context: {}, onReplace() {}, onNotice() {} }));
  assert.match(imported, /ангилал байхгүй тул санал гаргахгүй/);
});

test("D4 pairing states: loading skeleton, error with retry, an honest rule note, a new-instance action", () => {
  const { RoomProductPairings } = loadSource("src/features/room-planner/components/RoomProductOptions.tsx", {
    "next/image": image,
    "@/components/PlannerLink": link,
    "@/store/wishlist": { useWishlist: store({ has: () => false, toggle() {} }) },
    "@/store/roomModelStatus": { useRoomModelStatus: store({ byInstance: {}, swapFailed: {}, previous: {} }) },
  });
  const base = { hasSource: true, suggestions: [{ product: product("side", "side-table"), reason: "Буйдан-тай хамт хэрэглэдэг: хажуугийн ширээ" }], onAdd() {} };
  assert.match(renderToStaticMarkup(h(RoomProductPairings, { ...base, state: "loading" })), /aria-busy="true"/);
  assert.match(renderToStaticMarkup(h(RoomProductPairings, { ...base, state: "error", onRetry() {} })), /role="alert"[\s\S]*Дахин оролдох/);
  const ready = renderToStaticMarkup(h(RoomProductPairings, base));
  assert.match(ready, /Санал · ангиллын дүрмээр \(баталгаатай нийцэл биш\)/);
  assert.match(ready, /Өрөөнд нэмэх/);
  assert.doesNotMatch(ready, /Үүгээр солих/, "pairing never reuses the replace action");
  assert.match(renderToStaticMarkup(h(RoomProductPairings, { ...base, suggestions: [] })), /хослуулах 3D бэлэн бараа одоогоор алга/);
});

test("D5 phone toolbar: copy, focus and remove move under «Бусад»; replace/pair open the sheet full", () => {
  const { RoomSelectionToolbar } = loadSource("src/features/room-planner/components/RoomSelectionToolbar.tsx", {
    "@/store/selectionAnchor": { useSelectionAnchor: Object.assign(() => null, { getState: () => ({ instanceId: null, rect: null }), subscribe: () => () => {} }) },
  });
  const actions = [
    { id: "cart", label: "Сагсанд", icon: null, run() {}, primary: true },
    { id: "copy", label: "Хуулбарлах", icon: null, run() {}, more: true },
    { id: "remove", label: "Устгах", menuLabel: "Өрөөнөөс устгах", icon: null, run() {}, more: true },
  ];
  const html = renderToStaticMarkup(h(RoomSelectionToolbar, { instanceId: "p", title: "Луна", number: 1, actions, onClose() {} }));
  assert.match(html, /class="is-more"[^>]*aria-label="Хуулбарлах"/);
  assert.match(html, /aria-haspopup="menu" aria-expanded="false" aria-label="Бусад үйлдэл"/);
  const source = read("src/components/RoomPlanner.tsx");
  assert.match(source, /label: "Хуулбарлах",[\s\S]{0,140}more: true/);
  assert.match(source, /label: "Устгах",\s*menuLabel: "Өрөөнөөс устгах",[\s\S]{0,140}more: true/);
  assert.match(source, /label: "Төвлөрүүлэх",\s*menuLabel: "Төвлөрүүлж харах",[\s\S]{0,140}more: true/);
  assert.match(source, /expandRequest=\{optionsReveal\}/);
  assert.match(read("src/features/room-planner/components/RoomWorkspacePanel.tsx"), /if \(expandRequest > 0 && isPhone\(\)\) setFull\(true\);/);
});
