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

test("gallery details open on touch, close on repeated tap or Escape, and leave the furniture image unchanged", () => {
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
  const toggle = root => nodes(root).find(node => node.props.className === "product-details-toggle");
  let root = render();
  assert.equal(panel(root).props.inert, true);
  root.props.onPointerEnter({ pointerType: "touch" });
  assert.equal(toggle(render()).props["aria-expanded"], false);
  toggle(render()).props.onClick();
  root = render();
  assert.equal(panel(root).props.inert, false);
  assert.equal(toggle(root).props["aria-expanded"], true);
  const images = nodes(root).filter(node => node.props?.src);
  assert.deepEqual(images.map(node => node.props.src), ["/chair.jpg"]);
  assert.equal(images[0].props.quality, 90);
  nodes(root).find(node => node.props.className === "product-add-cart").props.onClick();
  assert.equal(added.unitPrice, 689000);
  assert.equal(added.color, "oak");
  toggle(render()).props.onClick();
  assert.equal(panel(render()).props.inert, true);
  root = render();
  root.props.onPointerEnter({ pointerType: "mouse" });
  assert.equal(toggle(render()).props["aria-expanded"], true);
  let focused = false;
  render().props.onKeyDown({ key: "Escape", currentTarget: { querySelector: () => ({ focus() { focused = true; } }) } });
  assert.equal(focused, true);
  assert.equal(panel(render()).props.inert, true);
});
