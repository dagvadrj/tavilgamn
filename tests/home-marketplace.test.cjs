const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { readFileSync } = require("node:fs");
const { loadSource } = require("./helpers/load-source.cjs");

const chair = {
  id: "chair",
  name: "Царсан сандал",
  description: "",
  category: "office",
  image: "/chair.jpg",
  basePrice: 1500000,
  defaultColor: "oak",
  colors: [{ id: "oak", name: "Царс", hex: "#c9aa80", priceDelta: 12000 }],
  materials: [{ id: "wood", name: "Мод", priceDelta: 3000 }],
  dimensions: { w: 0.5, d: 0.5, h: 0.9 },
  stockQuantity: 3,
  inStock: true,
  rating: 4.5,
  reviewCount: 10,
  storeIds: ["shop"],
};
const store = {
  id: "shop",
  name: "Өргөө",
  city: "Улаанбаатар",
  district: "Хан-Уул",
};

test("homepage presentation preserves real photography, default variants and Mongolian price format", () => {
  const lib = loadSource("src/lib/homeMarketplace.ts");
  assert.equal(lib.marketplacePrice(1890000), "1,890,000₮");
  assert.equal(lib.hasProductPhoto(chair), true);
  for (const image of [
    "",
    "/image.png",
    "/public/image.png",
    "/placeholder.svg",
  ])
    assert.equal(lib.hasProductPhoto({ image }), false);
  assert.equal(lib.defaultCartSelection(chair).unitPrice, 1515000);
  assert.equal(lib.defaultCartSelection({ ...chair, colors: [] }), null);
  assert.equal(lib.defaultCartSelection({ ...chair, materials: [] }), null);
  assert.equal(
    lib.defaultCartSelection({ ...chair, defaultColor: "missing" }).color.id,
    "oak",
  );
  const { ProductCard } = loadSource("src/components/ProductCard.tsx");
  const html = renderToStaticMarkup(
    React.createElement(ProductCard, {
      product: { ...chair, compareAtPrice: 2000000 },
    }),
  );
  assert.ok(html.includes("1,515,000₮") && html.includes("−24%"));
  const noDiscount = renderToStaticMarkup(
    React.createElement(ProductCard, {
      product: { ...chair, compareAtPrice: 1510000 },
    }),
  );
  assert.ok(!noDiscount.includes("<del") && !noDiscount.includes("−0%"));
});

test("store tiles use weighted real product reviews, never synthetic store ratings or sales", () => {
  const { storeCatalogStats } = loadSource("src/lib/homeMarketplace.ts");
  const stats = storeCatalogStats(store, [
    chair,
    { ...chair, id: "second", rating: 5, reviewCount: 30 },
    { ...chair, id: "unrated", rating: 0, reviewCount: 0 },
  ]);
  assert.equal(stats.productCount, 3);
  assert.equal(stats.reviewCount, 40);
  assert.equal(stats.rating, 4.875);
  assert.equal(storeCatalogStats({ id: "empty" }, [chair]).rating, null);
  const { FeaturedMerchants } = loadSource(
    "src/components/FeaturedMerchants.tsx",
  );
  const html = renderToStaticMarkup(
    React.createElement(FeaturedMerchants, {
      stores: [store],
      products: [chair],
    }),
  );
  assert.ok(
    html.includes("Онцлох дэлгүүрүүд") &&
      html.includes("Барааны үнэлгээ") &&
      html.includes("1 бараа"),
  );
  assert.ok(!html.includes("зарагдсан"));
});

test("daily timer follows Ulaanbaatar midnight, independent of browser timezone or promotion expiry", () => {
  const { endOfMarketplaceDay, marketplaceDayDigits } = loadSource(
    "src/lib/homeMarketplace.ts",
  );
  const before = Date.parse("2026-10-02T15:59:59Z");
  assert.equal(endOfMarketplaceDay(before), Date.parse("2026-10-02T16:00:00Z"));
  assert.deepEqual(marketplaceDayDigits(before), ["00", "00", "01"]);
  assert.deepEqual(marketplaceDayDigits(before + 1000), ["24", "00", "00"]);
  assert.deepEqual(marketplaceDayDigits(Date.parse("2026-10-02T00:00:00Z")), [
    "16",
    "00",
    "00",
  ]);
});

test("homepage payment labels use checkout availability, never advertise unconfigured providers", () => {
  const available = loadSource("src/lib/paymentPresentationServer.ts", {
    "@/lib/payments/providers": {
      paymentConfigured: (method) => method === "bank_transfer",
    },
  });
  assert.deepEqual(available.configuredPaymentLabels(), ["Банкны шилжүүлэг"]);
  const offline = loadSource("src/lib/paymentPresentationServer.ts", {
    "@/lib/payments/providers": { paymentConfigured: () => false },
  });
  assert.deepEqual(offline.configuredPaymentLabels(), []);
});

test("quick cart uses actual stock across variants and reports success or a full cart", () => {
  let callback, call, message;
  let index = 0;
  const { ProductCard } = loadSource("src/components/ProductCard.tsx", {
    react: {
      ...React,
      useEffect() {},
      useState() {
        // ProductCard state order: cartMessage, mounted, checkedAt.
        const value = ["", false, undefined][index++];
        return [
          value,
          (next) => {
            message = next;
          },
        ];
      },
    },
    "@/store/cart": {
      useCart: (selector) =>
        selector({
          add: (item) => {
            call = item;
            return 1;
          },
        }),
    },
    "@/store/wishlist": {
      useWishlist: (selector) => selector({ has: () => false, toggle() {} }),
    },
  });
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.props?.className === "product-add-cart")
      callback = node.props.onClick;
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
    react: {
      ...React,
      useEffect() {},
      useState() {
        return [
          ["", false, undefined][index++],
          (next) => {
            message = next;
          },
        ];
      },
    },
    "@/store/cart": { useCart: (selector) => selector({ add: () => 0 }) },
    "@/store/wishlist": {
      useWishlist: (selector) => selector({ has: () => false, toggle() {} }),
    },
  });
  visit(blocked.ProductCard({ product: chair }));
  callback();
  assert.equal(message, "Сагс дахь тоо үлдэгдлийн хязгаарт хүрсэн");
});

test("studio theme, responsive and reduced-motion contracts stay scoped to the shop", () => {
  const css = require("../scripts/styles/read.cjs")
    .readStylesheet("src/app/(shop)/storefront.css")
    .toString();
  const tokens = readFileSync("src/app/(shop)/shop-tokens.css", "utf8");
  for (const token of ["var(--site-bg)", "var(--site-ink)", "var(--site-accent)"])
    assert.ok(tokens.includes(token));
  assert.match(tokens, /\.shop-shell\s*\{/);
  assert.match(css, /color-scheme: light/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 999px\)/);
  assert.match(css, /@media \(max-width: 639px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /safe-area-inset-top/);
  const layout = readFileSync("src/app/(shop)/layout.tsx", "utf8");
  assert.match(layout, /site-ui shop-shell/);
  const sharedTheme = readFileSync("src/app/site-ui.css", "utf8");
  assert.match(sharedTheme, /--font-market-body:\s*var\(--font-sans\)/);
  const scopedRules = require("postcss").parse(sharedTheme);
  scopedRules.walkRules(rule => require("postcss-selector-parser")().astSync(rule.selector).each(selector => {
    assert.equal(selector.nodes[0]?.type, "class", `Unscoped shared UI rule: ${rule.selector}`);
    assert.equal(selector.nodes[0]?.value, "site-ui", `Unscoped shared UI rule: ${rule.selector}`);
  }));
  for (const path of [
    "src/app/(shop)/page.tsx",
    "src/components/Header.tsx",
    "src/components/Footer.tsx",
    "src/components/FeaturedMerchants.tsx",
  ])
    assert.ok(!readFileSync(path, "utf8").includes('"use client"'));
});

test("card color selection updates the shown price, detail link and exact cart variant together", () => {
  let stateIndex = 0;
  const values = ["", false, undefined, "oak"];
  let added;
  const { ProductCard } = loadSource("src/components/ProductCard.tsx", {
    react: {
      ...React,
      useEffect() {},
      useState(initial) {
        const index = stateIndex++;
        if (!(index in values)) values[index] = initial;
        return [values[index], next => { values[index] = next; }];
      },
    },
    "@/store/cart": { useCart: selector => selector({ add: item => { added = item; return 1; } }) },
    "@/store/wishlist": { useWishlist: selector => selector({ has: () => false, toggle() {} }) },
  });
  const product = {
    ...chair,
    colors: [...chair.colors, { id: "walnut", name: "Хушга", hex: "#654321", priceDelta: 70000 }],
    model: { id: "model", file: "/chair.glb", scale: 1 },
  };
  const nodes = root => {
    const result = [];
    const visit = node => {
      if (!node || typeof node !== "object") return;
      result.push(node);
      React.Children.forEach(node.props?.children, visit);
    };
    visit(root);
    return result;
  };
  const render = () => { stateIndex = 0; return nodes(ProductCard({ product })); };
  let tree = render();
  tree.find(node => node.props?.["aria-label"] === "Хушга").props.onClick();
  tree = render();
  assert.equal(tree.find(node => node.props?.["aria-label"] === "Хушга").props["aria-pressed"], true);
  assert.ok(tree.some(node => node.type === "strong" && node.props.children === "1,573,000₮"));
  const trigger = tree.find(node => node.props?.className === "product-view-model");
  assert.equal(trigger.type, "button");
  assert.equal(trigger.props["aria-haspopup"], "dialog");
  trigger.props.onClick();
  tree = render();
  const quickView = tree.find(node => node.props?.viewHref === "/product/chair?color=walnut&view=3d");
  assert.ok(quickView);
  assert.equal(quickView.props.price, 1573000);
  assert.equal(quickView.props.selection.color.id, "walnut");
  quickView.props.onAddToCart();
  assert.equal(added.color, "walnut");
  assert.equal(added.material, "wood");
  assert.equal(added.unitPrice, 1573000);
  assert.equal(added.stockQuantity, 3);
  quickView.props.onClose();
  assert.ok(!render().some(node => node.props?.viewHref));
});
