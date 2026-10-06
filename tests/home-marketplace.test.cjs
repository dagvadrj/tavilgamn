const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { readFileSync } = require("node:fs");
const { loadSource } = require("./helpers/load-source.cjs");

const chair = {
  id: "chair", name: "Царсан сандал", description: "", category: "office", image: "/chair.jpg",
  basePrice: 1500000, defaultColor: "oak",
  colors: [{ id: "oak", name: "Царс", hex: "#c9aa80", priceDelta: 12000 }],
  materials: [{ id: "wood", name: "Мод", priceDelta: 3000 }],
  dimensions: { w: .5, d: .5, h: .9 }, stockQuantity: 3, inStock: true,
  rating: 4.5, reviewCount: 10, storeIds: ["shop"],
};
const store = { id: "shop", name: "Өргөө", city: "Улаанбаатар", district: "Хан-Уул" };

test("homepage presentation preserves real photography, default variants and Mongolian price format", () => {
  const lib = loadSource("src/lib/homeMarketplace.ts");
  assert.equal(lib.marketplacePrice(1890000), "1,890,000₮");
  assert.equal(lib.hasProductPhoto(chair), true);
  for (const image of ["", "/image.png", "/public/image.png", "/placeholder.svg"]) assert.equal(lib.hasProductPhoto({ image }), false);
  assert.equal(lib.defaultCartSelection(chair).unitPrice, 1515000);
  assert.equal(lib.defaultCartSelection({ ...chair, colors: [] }), null);
  assert.equal(lib.defaultCartSelection({ ...chair, materials: [] }), null);
  assert.equal(lib.defaultCartSelection({ ...chair, defaultColor: "missing" }).color.id, "oak");
  const { ProductCard } = loadSource("src/components/ProductCard.tsx");
  const html = renderToStaticMarkup(React.createElement(ProductCard, { product: { ...chair, compareAtPrice: 2000000 } }));
  assert.ok(html.includes("1,515,000₮") && html.includes("−24%"));
  const noDiscount = renderToStaticMarkup(React.createElement(ProductCard, { product: { ...chair, compareAtPrice: 1510000 } }));
  assert.ok(!noDiscount.includes("<del") && !noDiscount.includes("−0%"));
});

test("store tiles use weighted real product reviews, never synthetic store ratings or sales", () => {
  const { storeCatalogStats } = loadSource("src/lib/homeMarketplace.ts");
  const stats = storeCatalogStats(store, [chair, { ...chair, id: "second", rating: 5, reviewCount: 30 }, { ...chair, id: "unrated", rating: 0, reviewCount: 0 }]);
  assert.equal(stats.productCount, 3);
  assert.equal(stats.reviewCount, 40);
  assert.equal(stats.rating, 4.875);
  assert.equal(storeCatalogStats({ id: "empty" }, [chair]).rating, null);
  const { FeaturedMerchants } = loadSource("src/components/FeaturedMerchants.tsx");
  const html = renderToStaticMarkup(React.createElement(FeaturedMerchants, { stores: [store], products: [chair] }));
  assert.ok(html.includes("Онцлох дэлгүүрүүд") && html.includes("Барааны үнэлгээ") && html.includes("1 бараа"));
  assert.ok(!html.includes("зарагдсан"));
});

test("daily timer follows Ulaanbaatar midnight, independent of browser timezone or promotion expiry", () => {
  const { endOfMarketplaceDay, marketplaceDayDigits } = loadSource("src/lib/homeMarketplace.ts");
  const before = Date.parse("2026-10-02T15:59:59Z");
  assert.equal(endOfMarketplaceDay(before), Date.parse("2026-10-02T16:00:00Z"));
  assert.deepEqual(marketplaceDayDigits(before), ["00", "00", "01"]);
  assert.deepEqual(marketplaceDayDigits(before + 1000), ["24", "00", "00"]);
  assert.deepEqual(marketplaceDayDigits(Date.parse("2026-10-02T00:00:00Z")), ["16", "00", "00"]);
});

test("homepage payment labels use checkout availability, never advertise unconfigured providers", () => {
  const available = loadSource("src/lib/paymentPresentationServer.ts", {
    "@/lib/payments/providers": { paymentConfigured: method => method === "bank_transfer" },
  });
  assert.deepEqual(available.configuredPaymentLabels(), ["Банкны шилжүүлэг"]);
  const offline = loadSource("src/lib/paymentPresentationServer.ts", {
    "@/lib/payments/providers": { paymentConfigured: () => false },
  });
  assert.deepEqual(offline.configuredPaymentLabels(), []);
});

test("homepage stays server-rendered, load-more is bounded, and placeholder or uncounted products are excluded", async () => {
  const products = Array.from({ length: 17 }, (_, index) => ({ ...chair, id: `chair-${index}` }));
  products.push({ ...chair, id: "placeholder", image: "/image.png" }, { ...chair, id: "unknown-stock", stockQuantity: null });
  const Home = loadSource("src/app/(shop)/page.tsx", {
    "@/lib/catalogServer": { readProducts: async () => products },
    "@/lib/storeDirectory": { readStoreDirectory: async () => [] },
    "@/components/FeaturedMerchants": { FeaturedMerchants: () => null },
    "@/components/HomeRecommendationsRefresh": { HomeRecommendationsRefresh: () => null },
    "@/components/ProductCard": { ProductCard: ({ product }) => React.createElement("article", { "data-product": product.id }) },
    "next/image": { default: ({ alt }) => React.createElement("span", { "aria-label": alt }) },
  }).default;
  const html = renderToStaticMarkup(await Home({}));
  assert.equal((html.match(/data-product=/g) || []).length, 18); // Eight daily + ten recommended.
  assert.ok(html.includes("Дахин үзүүлэх") && html.includes('name="limit" value="20"'));
  assert.ok(html.includes("Өнөөдрийн сонголт") && !html.includes('id="offers-title"'));
  assert.ok(!html.includes("placeholder") && !html.includes("unknown-stock") && !html.includes("14 хоног"));
  assert.ok(html.includes("1,500,000₮-өөс дээш") && html.includes("Карт / зээл — тун удахгүй"));
  const more = renderToStaticMarkup(await Home({ searchParams: Promise.resolve({ limit: "20" }) }));
  assert.equal((more.match(/data-product=/g) || []).length, 25);
  assert.ok(!more.includes("Дахин үзүүлэх"));
  const invalid = renderToStaticMarkup(await Home({ searchParams: Promise.resolve({ limit: "-10" }) }));
  assert.equal((invalid.match(/data-product=/g) || []).length, 18);
});

test("quick cart uses actual stock across variants and reports success or a full cart", () => {
  let callback, call, message;
  let index = 0;
  const { ProductCard } = loadSource("src/components/ProductCard.tsx", {
    react: { ...React, useEffect() {}, useState() {
      // ProductCard state order: cartMessage, mounted, checkedAt.
      const value = ["", false, undefined][index++];
      return [value, next => { message = next; }];
    } },
    "@/store/cart": { useCart: selector => selector({ add: item => { call = item; return 1; } }) },
    "@/store/wishlist": { useWishlist: selector => selector({ has: () => false, toggle() {} }) },
  });
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.props?.className === "product-add-cart") callback = node.props.onClick;
    React.Children.forEach(node.props?.children, visit);
  }
  visit(ProductCard({ product: chair }));
  callback();
  assert.equal(call.unitPrice, 1515000);
  assert.equal(call.stockQuantity, 3);
  assert.equal(call.color, "oak");
  assert.equal(call.material, "wood");
  assert.equal(message, "Сагсанд нэмэгдлээ");
  index = 0;
  const blocked = loadSource("src/components/ProductCard.tsx", {
    react: { ...React, useEffect() {}, useState() { return [["", false, undefined][index++], next => { message = next; }]; } },
    "@/store/cart": { useCart: selector => selector({ add: () => 0 }) },
    "@/store/wishlist": { useWishlist: selector => selector({ has: () => false, toggle() {} }) },
  });
  visit(blocked.ProductCard({ product: chair }));
  callback();
  assert.equal(message, "Сагс дахь тоо үлдэгдлийн хязгаарт хүрсэн");
});

test("studio theme, responsive and reduced-motion contracts stay scoped to the shop", () => {
  const css = readFileSync("src/app/(shop)/storefront.css", "utf8");
  const tokens = readFileSync("src/app/(shop)/shop-tokens.css", "utf8");
  for (const token of ["#fafafa", "#111111", "#2563eb"]) assert.ok(tokens.includes(token));
  assert.match(tokens, /\.shop-shell\s*\{/);
  assert.match(css, /color-scheme: light/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 999px\)/);
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /safe-area-inset-top/);
  const carousel = readFileSync("src/components/HomeCarousel.tsx", "utf8");
  assert.match(carousel, /if \(reduced \|\| paused \|\| interacting \|\| focused \|\| !visible/);
  assert.match(carousel, /5000/);
  assert.match(carousel, /aria-pressed/);
  const layout = readFileSync("src/app/(shop)/layout.tsx", "utf8");
  assert.match(layout, /Manrope/); assert.match(layout, /"cyrillic"/);
  for (const path of ["src/app/(shop)/page.tsx", "src/components/Header.tsx", "src/components/Footer.tsx", "src/components/FeaturedMerchants.tsx"]) assert.ok(!readFileSync(path, "utf8").includes('"use client"'));
});
