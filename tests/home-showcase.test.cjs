const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");
const { buildRoomLooks } = loadSource("src/lib/shopTheLook.ts");
const product = (id, category) => ({
  id, category, name: id, description: "", image: `/${id}.jpg`, basePrice: 100000,
  colors: [], materials: [], defaultColor: "", dimensions: { w: 1, d: 1, h: 1 },
  stockQuantity: 2, inStock: true, rating: 0, reviewCount: 0,
});
const catalog = [product("sofa", "sofa"), product("shelf", "bookshelf"), product("tv", "tv-stand"), product("bed", "bed")];
function find(tree, name) {
  if (!React.isValidElement(tree)) return;
  if (tree.type?.name === name) return tree;
  for (const child of React.Children.toArray(tree.props.children)) {
    const result = find(child, name);
    if (result) return result;
  }
}

test("the single room selection updates its scene, furniture and benefit text without a duplicate showroom", () => {
  let roomId;
  const { HomeContent } = loadSource("src/components/pages/HomePageClient.tsx", {
    react: { ...React, useState: initial => [roomId ?? initial, value => { roomId = value; }] },
  });
  const data = { catalog, stores: [], paymentLabels: [] };
  let tree = HomeContent(data);
  assert.equal(find(tree, "HomeShowcase").props.room.id, "living");
  assert.equal(find(tree, "ShopTheLook"), undefined);
  find(tree, "HomeShowcase").props.onRoomChange("bedroom");
  tree = HomeContent(data);
  const room = find(tree, "HomeShowcase").props.room;
  assert.equal(room.image, "/rooms/bedroom.webp");
  assert.deepEqual(room.products.map(item => item.id), ["bed"]);
});

test("side cards, numbered room links and benefits all use the same real room furniture; empty rooms invent no products", () => {
  const { HomeShowcase } = loadSource("src/components/HomeShowcase.tsx", {
    "@/components/ProductCard": { ProductCard: ({ product }) => React.createElement("article", { "data-product": product.id }) },
    "next/image": { default: ({ src, alt }) => React.createElement("img", { src, alt }) },
  });
  const rooms = buildRoomLooks(catalog);
  const html = renderToStaticMarkup(React.createElement(HomeShowcase, { room: rooms[0] }));
  assert.ok(html.includes('src="/rooms/living-room.webp"'));
  for (const id of ["sofa", "shelf", "tv"]) {
    assert.ok(html.includes(`data-product="${id}"`));
    assert.equal((html.match(new RegExp(`href="/product/${id}"`, "g")) || []).length, 2);
  }
  assert.ok(!html.includes('data-product="bed"'));
  const empty = renderToStaticMarkup(React.createElement(HomeShowcase, { room: buildRoomLooks([])[0] }));
  assert.ok(!empty.includes("data-product") && !empty.includes('class="home-showcase-hotspot"'));
  assert.ok(empty.includes('/catalog?room=living'));
});
