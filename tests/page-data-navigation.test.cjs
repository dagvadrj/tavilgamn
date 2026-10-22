const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");

test("page data is not requested by server rendering or route prefetch", () => {
  const original = global.fetch;
  let requests = 0;
  global.fetch = () => { requests++; throw new Error("Eager data request"); };
  try {
    const { RemotePage } = loadSource("src/components/RemotePage.tsx");
    const html = renderToStaticMarkup(React.createElement(RemotePage, {
      page: "home", variant: "home", children: () => "loaded content",
    }));
    assert.equal(requests, 0);
    assert.match(html, /page-skeleton/);
    assert.ok(!html.includes("loaded content"));
  } finally { global.fetch = original; }
});

test("GET starts after the destination has a paint, cancels on navigation, and ignores a stale response", async () => {
  const original = { fetch: global.fetch, raf: global.requestAnimationFrame, cancel: global.cancelAnimationFrame };
  const frames = new Map(), requests = [], state = [];
  let sequence = 0, index = 0, effect;
  global.requestAnimationFrame = callback => { frames.set(++sequence, callback); return sequence; };
  global.cancelAnimationFrame = id => frames.delete(id);
  global.fetch = (url, options) => new Promise(resolve => requests.push({ url, options, resolve }));
  const paint = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); };
  const settle = () => new Promise(resolve => setImmediate(resolve));
  let cleanup;
  try {
    const { RemotePage } = loadSource("src/components/RemotePage.tsx", {
      react: { ...React,
        useEffect(callback) { effect = callback; },
        useState(initial) {
          const slot = index++;
          if (!(slot in state)) state[slot] = initial;
          return [state[slot], next => { state[slot] = typeof next === "function" ? next(state[slot]) : next; }];
        },
      },
    });
    const render = id => { index = 0; return RemotePage({ page: "product", id, variant: "detail", children: data => data.product.name }); };
    assert.equal(render("first").props.variant, "detail");
    assert.equal(requests.length, 0);
    cleanup = effect();
    assert.equal(requests.length, 0);
    paint();
    assert.equal(requests.length, 0, "the skeleton gets a paint before GET");
    paint();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "/api/page-data/product?id=first");
    cleanup();
    assert.equal(requests[0].options.signal.aborted, true);
    render("second");
    cleanup = effect();
    paint(); paint();
    requests[1].resolve({ ok: true, json: async () => ({ product: { name: "Second product" } }) });
    await settle();
    requests[0].resolve({ ok: true, json: async () => ({ product: { name: "Stale product" } }) });
    await settle();
    assert.equal(render("second").props.children, "Second product");
    assert.equal(render("third").props.variant, "detail", "a new URL never displays the old data");
    cleanup();
    cleanup = effect();
    cleanup();
    paint(); paint();
    assert.equal(requests.length, 2, "leaving before the paint prevents GET entirely");
  } finally {
    cleanup?.();
    global.fetch = original.fetch;
    global.requestAnimationFrame = original.raf;
    global.cancelAnimationFrame = original.cancel;
  }
});

test("public page GET preserves counts, hides unavailable products and reports missing/error responses", async () => {
  const product = { id: "chair", category: "chair", stockQuantity: 2, inStock: true };
  const store = { id: "store", name: "Store" };
  const homepageProductIds = ["featured-sofa", "featured-chair"];
  let fail = false;
  const { GET } = loadSource("src/app/api/page-data/[page]/route.ts", {
    "@/lib/catalogServer": { readProduct: async id => id === "chair" ? product : undefined },
    "@/lib/publicCatalog": {
      readCachedProducts: async () => { if (fail) throw new Error("private database error"); return [product]; },
      readCachedStoreDirectory: async () => [store],
      readCachedDirectoryStore: async id => id === store.id ? store : undefined,
      readCachedStoreProductCounts: async () => new Map([[store.id, 12]]),
    },
    "@/lib/kitchenMarketplaceServer": { readPublishedKitchenDesigns: async () => [], readPublishedKitchenDesignBySlug: async () => null },
    "@/lib/paymentPresentationServer": { configuredPaymentLabels: () => ["Bank"] },
    "@/lib/homepageSettingsServer": { readHomepageSettings: async () => ({ productIds: homepageProductIds, version: 3 }) },
  });
  const get = (page, id = "") => GET(new Request(`http://localhost/api/page-data/${page}?id=${id}`), { params: Promise.resolve({ page }) });
  assert.deepEqual(await (await get("stores")).json(), { directory: [store], productCounts: { store: 12 } });
  assert.deepEqual(await (await get("home")).json(), { catalog: [product], stores: [store], paymentLabels: ["Bank"], homepageProductIds });
  assert.equal((await get("product", "chair")).status, 200);
  product.stockQuantity = 0;
  assert.equal((await get("product", "chair")).status, 404);
  assert.equal((await get("product", "missing")).status, 404);
  assert.equal((await get("store", "missing")).status, 404);
  assert.equal((await get("kitchen", "missing")).status, 404);
  assert.equal((await get("unknown")).status, 404);
  fail = true;
  const unavailable = await get("home");
  assert.equal(unavailable.status, 503);
  assert.ok(!(await unavailable.text()).includes("private database error"));
});
