const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { loadSource } = require("./helpers/load-source.cjs");

const product = {
  id: "chair", name: "Chair", category: "chair", image: "/chair.jpg", images: ["/chair.jpg", "/other.jpg"],
  basePrice: 689000, defaultColor: "oak", colors: [{ id: "oak", name: "Oak", hex: "#ccc", priceDelta: 0 }],
  materials: [{ id: "wood", name: "Wood", priceDelta: 0 }], dimensions: { w: .8, d: .85, h: .78 },
  stockQuantity: 2, inStock: true, rating: 0, reviewCount: 0,
};

function nodes(root) {
  const result = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    result.push(node);
    React.Children.forEach(node.props?.children, visit);
  }
  visit(root);
  return result;
}

test("product details are immediately accessible and the photo opens the selected product", () => {
  const values = [];
  let index = 0, added;
  const { ProductCard } = loadSource("src/components/ProductCard.tsx", {
    react: { ...React, useEffect() {}, useState(initial) {
      const slot = index++;
      if (!(slot in values)) values[slot] = initial;
      return [values[slot], next => { values[slot] = typeof next === "function" ? next(values[slot]) : next; }];
    } },
    "@/store/wishlist": { useWishlist: selector => selector({ has: () => false, toggle() {} }) },
    "@/store/cart": { useCart: selector => selector({ add: item => { added = item; return 1; } }) },
  });
  const render = () => { index = 0; return ProductCard({ product, catalogStyle: true }); };
  const panel = root => nodes(root).find(node => node.props.className === "gallery-product-info");
  const root = render();
  assert.ok(!panel(root).props.inert);
  assert.ok(!panel(root).props["aria-hidden"]);
  const photo = nodes(root).find(node => node.props.className === "gallery-photo-trigger");
  assert.equal(photo.props.href, "/product/chair?color=oak");
  const images = nodes(root).filter(node => node.props?.src);
  assert.deepEqual(images.map(node => node.props.src), ["/chair.jpg"]);
  assert.equal(images[0].props.quality, 95);
  nodes(root).find(node => node.props.className === "product-add-cart").props.onClick();
  assert.equal(added.unitPrice, 689000);
  assert.equal(added.color, "oak");
  assert.ok(!panel(render()).props.inert);
});
