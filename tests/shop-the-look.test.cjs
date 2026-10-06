const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");
const { buildRoomLooks } = loadSource("src/lib/shopTheLook.ts");
const fixture = (category, id = category) => ({
  id, category, name: id, image: "/furniture.jpg", description: "", basePrice: 100000,
  defaultColor: "cream", colors: [{ id: "cream", name: "Цагаан", hex: "#eeeeee" }, { id: "oak", name: "Царс", hex: "#c9aa80", priceDelta: 12000 }],
  materials: [{ id: "wood", name: "Мод", priceDelta: 3000 }],
  stockQuantity: 2, inStock: true, dimensions: { w: 1, d: 1, h: 1 }, rating: 0, reviewCount: 0,
});
function nodes(tree, predicate) {
  const found = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (predicate(node)) found.push(node);
    React.Children.forEach(node.props?.children, visit);
  }
  visit(tree);
  return found;
}
function harness(add = () => 1) {
  const state = new Map();
  let slots, cursor;
  const mockedReact = { ...React,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
  };
  const lib = loadSource("src/components/ShopTheLook.tsx", {
    react: mockedReact, "@/store/cart": { useCart: select => select({ add }) },
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/image": { default: ({ src, alt }) => React.createElement("img", { src, alt }) },
  });
  return { ...lib, render(component, props, key = component.name) { if (!state.has(key)) state.set(key, []); slots = state.get(key); cursor = 0; return component(props); } };
}

test("room sets exclude missing photographs and unavailable inventory, retain photographed categories and bound payloads", () => {
  const catalog = [fixture("sofa"), ...Array.from({ length: 15 }, (_, i) => fixture("sofa", `sofa-${i}`)), fixture("bookshelf"), fixture("tv-stand"), fixture("bed"), fixture("wardrobe"), fixture("oven"),
    { ...fixture("sofa", "empty"), stockQuantity: 0 }, { ...fixture("sofa", "unknown"), stockQuantity: null }, { ...fixture("sofa", "placeholder"), image: "/image.png" }];
  const rooms = buildRoomLooks(catalog);
  assert.equal(rooms.length, 4);
  assert.equal(rooms[0].products.length, 8);
  assert.deepEqual(rooms[0].hotspots.map(point => point.productId), ["sofa", "bookshelf", "tv-stand"]);
  for (const room of rooms) {
    assert.ok(room.image.startsWith("/rooms/"));
    assert.ok(room.products.every(product => !["empty", "unknown", "placeholder"].includes(product.id)));
    assert.ok(room.hotspots.every(point => room.products.some(product => product.id === point.productId)));
  }
  assert.equal(catalog.length, 24);
  assert.equal(buildRoomLooks([]).every(room => !room.hotspots.length && !room.products.length), true);
});

test("room pills replace the room and product set immediately with a new scene key", () => {
  const h = harness();
  const rooms = buildRoomLooks([fixture("sofa"), fixture("bed")]);
  let tree = h.render(h.ShopTheLook, { rooms });
  nodes(tree, node => node.type === "button" && node.props.children === "Унтлагын өрөө")[0].props.onClick();
  tree = h.render(h.ShopTheLook, { rooms });
  const scene = nodes(tree, node => node.type?.name === "RoomScene")[0];
  assert.equal(scene.key, "bedroom");
  assert.deepEqual(scene.props.room.products.map(product => product.id), ["bed"]);
});

test("hotspots open with mouse or tap; Escape dismisses and returns focus to the trigger", () => {
  const h = harness();
  const scene = nodes(h.render(h.ShopTheLook, { rooms: buildRoomLooks([fixture("sofa")]) }), node => node.type?.name === "RoomScene")[0];
  let tree = h.render(scene.type, scene.props);
  const hotspot = nodes(tree, node => node.props?.className === "look-hotspot")[0];
  let focused = false;
  const trigger = { focus() { focused = true; } };
  hotspot.props.onPointerEnter({ pointerType: "touch", currentTarget: trigger });
  assert.equal(nodes(h.render(scene.type, scene.props), node => node.type?.name === "LookProduct").length, 0);
  hotspot.props.onPointerEnter({ pointerType: "mouse", currentTarget: trigger });
  tree = h.render(scene.type, scene.props);
  assert.equal(nodes(tree, node => node.type?.name === "LookProduct")[0].props.product.id, "sofa");
  tree.props.onKeyDown({ key: "Escape", preventDefault() {} });
  assert.equal(focused, true);
  assert.equal(nodes(h.render(scene.type, scene.props), node => node.type?.name === "LookProduct").length, 0);
  hotspot.props.onClick({ currentTarget: trigger });
  assert.equal(nodes(h.render(scene.type, scene.props), node => node.type?.name === "LookProduct").length, 1);
});

test("selected colors change displayed price, 3D URL and cart data; full inventory reports failure", () => {
  let added;
  let allowed = 1;
  const h = harness(item => { added = item; return allowed; });
  const product = { ...fixture("sofa"), model: { id: "model", file: "model.glb", scale: 1 } };
  const scene = nodes(h.render(h.ShopTheLook, { rooms: buildRoomLooks([product]) }), node => node.type?.name === "RoomScene")[0];
  let tree = h.render(scene.type, scene.props);
  nodes(tree, node => node.props?.className === "look-hotspot")[0].props.onClick({ currentTarget: { focus() {} } });
  const popup = nodes(h.render(scene.type, scene.props), node => node.type?.name === "LookProduct")[0];
  tree = h.render(popup.type, popup.props);
  nodes(tree, node => node.type === "button" && node.props["aria-label"] === "Царс")[0].props.onClick();
  tree = h.render(popup.type, popup.props);
  assert.ok(renderToStaticMarkup(tree).includes("115,000₮"));
  assert.ok(nodes(tree, node => node.props?.href === "/product/sofa?view=3d&color=oak").length);
  nodes(tree, node => node.type === "button" && node.props.onClick && node.props.disabled === false)[0].props.onClick();
  assert.equal(added.unitPrice, 115000);
  assert.equal(added.color, "oak");
  assert.equal(added.material, "wood");
  assert.equal(added.stockQuantity, 2);
  assert.ok(renderToStaticMarkup(h.render(popup.type, popup.props)).includes("Сагсанд нэмэгдлээ"));
  allowed = 0;
  nodes(tree, node => node.type === "button" && node.props.disabled === false)[0].props.onClick();
  assert.ok(renderToStaticMarkup(h.render(popup.type, popup.props)).includes("үлдэгдлийн хязгаарт хүрсэн"));
});

test("products without models never advertise a working 3D link", () => {
  const h = harness();
  const scene = nodes(h.render(h.ShopTheLook, { rooms: buildRoomLooks([fixture("sofa")]) }), node => node.type?.name === "RoomScene")[0];
  nodes(h.render(scene.type, scene.props), node => node.props?.className === "look-hotspot")[0].props.onClick({ currentTarget: { focus() {} } });
  const popup = nodes(h.render(scene.type, scene.props), node => node.type?.name === "LookProduct")[0];
  const html = renderToStaticMarkup(h.render(popup.type, popup.props));
  assert.ok(html.includes("3D загвар нэмэгдээгүй"));
  assert.ok(!html.includes("view=3d"));
});
