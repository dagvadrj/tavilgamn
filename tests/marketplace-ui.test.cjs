const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { readFileSync } = require("node:fs");
const { loadSource } = require("./helpers/load-source.cjs");

const now = Date.parse("2026-10-02T10:00:00Z");
const product = {
  id: "chair", name: "Царсан сандал", description: "Байгалийн мод", category: "office",
  image: "/chair.jpg", basePrice: 80000, rating: 0, reviewCount: 0,
  dimensions: { w: .5, d: .6, h: .9 }, colors: [], materials: [],
  defaultColor: "oak", stockQuantity: 5, inStock: true,
};

test("offer presentation accepts only authored prices and active promotion metadata", () => {
  const { productOffer, hasProductOffer } = loadSource("src/lib/catalogPresentation.ts");
  assert.deepEqual(productOffer(product, now), { compareAtPrice: null, discountPercent: null, label: null });
  assert.deepEqual(productOffer({ ...product, compareAtPrice: 100000 }, now), { compareAtPrice: 100000, discountPercent: 20, label: null });
  for (const compareAtPrice of [0, 79000, 80000, NaN, Infinity]) assert.equal(productOffer({ ...product, compareAtPrice }, now).compareAtPrice, null);
  const limited = { ...product, compareAtPrice: 100000, promotionLabel: " Намрын санал ", promotionEndsAt: "2026-10-03T00:00:00Z" };
  assert.equal(hasProductOffer(limited, now), true);
  assert.equal(productOffer(limited, now).label, "Намрын санал");
  assert.equal(hasProductOffer(limited, Date.parse(limited.promotionEndsAt)), false);
  assert.equal(hasProductOffer({ ...limited, promotionEndsAt: "not-a-date" }, now), false);
  // A deadline requires an explicit shared time for SSR, so hydration cannot disagree.
  assert.equal(productOffer(limited).compareAtPrice, null);
  assert.equal(productOffer({ ...product, promotionLabel: " " }, now).label, null);
});

test("marketplace cards show real price, inventory, optional delivery and no fabricated rating", () => {
  const { ProductCard } = loadSource("src/components/ProductCard.tsx");
  const plain = renderToStaticMarkup(React.createElement(ProductCard, { product, offerCheckedAt: now }));
  assert.ok(plain.includes("₮80,000") && plain.includes("Үлдэгдэл: 5 ширхэг"));
  assert.ok(plain.includes("50 × 60 × 90 см"));
  assert.ok(!plain.includes("<del") && !plain.includes("product-rating") && !plain.includes("product-delivery"));
  const actual = renderToStaticMarkup(React.createElement(ProductCard, { product: { ...product, compareAtPrice: 100000, promotionLabel: "Намрын санал", promotionEndsAt: "2026-10-03T00:00:00Z", deliveryTerms: "Хүргэлтийн нөхцөлийг дэлгүүртэй тохирно", rating: 4.5, reviewCount: 12, model: { id: "m", file: "/m.glb", scale: 1 } }, offerCheckedAt: now }));
  assert.ok(actual.includes("−20%") && actual.includes("₮100,000") && actual.includes("Намрын санал"));
  assert.ok(actual.includes("3D үзэх") && actual.includes("(12)") && actual.includes("Хүргэлтийн нөхцөлийг дэлгүүртэй тохирно"));
  const expired = renderToStaticMarkup(React.createElement(ProductCard, { product: { ...product, compareAtPrice: 100000, promotionLabel: "Намрын санал", promotionEndsAt: "2026-10-01T00:00:00Z" }, offerCheckedAt: now }));
  assert.ok(!expired.includes("<del") && !expired.includes("Намрын санал"));
});

test("catalog quick filters compose promotion and 3D filters without promising stock not counted", () => {
  function render(offersOnly, modelsOnly) {
    const values = [1, "featured", "", "", offersOnly, modelsOnly];
    let index = 0;
    const { CatalogProducts } = loadSource("src/components/CatalogProducts.tsx", {
      react: { ...React, useEffect() {}, useState() { return [values[index++], () => {}]; } },
      "@/store/catalog": { useCatalog: () => ({ ready: true, loading: false, error: null, products: [product, { ...product, id: "offer", compareAtPrice: 100000, model: { id: "m", file: "/m.glb" } }, { ...product, id: "unknown", stockQuantity: null }] }) },
      "./ProductCard": { ProductCard: ({ product }) => React.createElement("article", { "data-product": product.id }) },
    });
    return renderToStaticMarkup(CatalogProducts({ query: "", categories: [] }));
  }
  const all = render(false, false);
  assert.ok(all.includes("2 илэрц") && all.includes('data-product="chair"') && all.includes('data-product="offer"'));
  assert.ok(!all.includes('data-product="unknown"'));
  const offers = render(true, true);
  assert.ok(offers.includes("1 илэрц") && offers.includes('data-product="offer"') && !offers.includes('data-product="chair"'));
  assert.ok(offers.includes("Хямдрал, урамшуулал") && offers.includes("Үнийн хүрээ"));
});

test("home promotion section is conditional on real currently available product offers", async () => {
  async function render(products) {
    const Home = loadSource("src/app/(shop)/page.tsx", {
      "@/lib/catalogServer": { readProducts: async () => products },
      "@/lib/storeDirectory": { readStoreDirectory: async () => [] },
      "@/components/FeaturedMerchants": { FeaturedMerchants: () => null },
      "@/components/ProductCard": { ProductCard: ({ product }) => React.createElement("article", { "data-product": product.id }) },
      "next/image": { default: ({ alt }) => React.createElement("span", { "aria-label": alt }) },
    }).default;
    return renderToStaticMarkup(await Home());
  }
  assert.ok(!(await render([product])).includes('id="offers-title"'));
  const offered = await render([{ ...product, compareAtPrice: 100000 }]);
  assert.ok(offered.includes('id="offers-title"') && offered.includes("/catalog?offers=1"));
  assert.ok(!(await render([{ ...product, compareAtPrice: 100000, stockQuantity: 0 }])).includes('id="offers-title"'));
});

test("store styling is isolated from fullscreen planners and supports small touch screens", () => {
  const css = readFileSync("src/app/(shop)/marketplace.css", "utf8");
  assert.match(css, /\.shop-shell \.marketplace-product-card/);
  assert.match(css, /@media \(max-width: 420px\)/);
  assert.match(css, /\.catalog-quick-filters > button \{ min-height: 44px/);
  const planner = readFileSync("src/app/(planner)/layout.tsx", "utf8");
  assert.ok(!planner.includes("marketplace.css"));
});
