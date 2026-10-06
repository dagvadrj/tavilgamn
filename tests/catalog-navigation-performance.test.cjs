const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");

test("fast catalog remounts reuse data, stale refreshes keep results visible and explicit refreshes always run", async () => {
  const original = { fetch: global.fetch, window: global.window, document: global.document, now: Date.now };
  let now = 100000, requests = 0, fail = false;
  const listeners = new Map();
  const product = { id: "sofa", image: "/sofa.jpg" };
  try {
    Date.now = () => now;
    global.document = { visibilityState: "visible" };
    global.window = { addEventListener(name, fn) { listeners.set(name, fn); }, removeEventListener() {} };
    global.fetch = async () => { requests++; if (fail) throw new Error("offline"); return { ok: true, json: async () => ({ products: [product] }) }; };
    const lib = loadSource("src/store/catalog.ts", {
      react: { useEffect(fn) { fn(); } },
      zustand: { create(init) {
        let state;
        const set = patch => { state = { ...state, ...patch }; };
        const store = () => state;
        store.getState = () => state;
        state = init(set);
        return store;
      } },
      "@/lib/modelRegistry": { replaceDbModels() {} },
      "@/lib/catalogValidation": { parseProduct: value => value },
    });
    await lib.useCatalogStore.getState().refresh();
    assert.equal(requests, 1);
    lib.useCatalog();
    listeners.get("focus")();
    assert.equal(requests, 1);
    now += 30001;
    fail = true;
    listeners.get("focus")();
    assert.equal(lib.useCatalogStore.getState().ready, true);
    assert.equal(lib.useCatalogStore.getState().loading, true);
    // Reuse the in-flight request to await its completion.
    await lib.useCatalogStore.getState().refresh();
    assert.equal(requests, 2);
    assert.equal(lib.useCatalogStore.getState().ready, true);
    assert.deepEqual(lib.useCatalogStore.getState().products, [product]);
    assert.equal(lib.useCatalogStore.getState().error, "offline");
    fail = false;
    await lib.useCatalogStore.getState().refresh(true);
    assert.equal(requests, 3);
    assert.equal(lib.useCatalogStore.getState().error, null);
    await lib.useCatalogStore.getState().refresh(true);
    assert.equal(requests, 4);
  } finally {
    global.fetch = original.fetch;
    global.window = original.window;
    global.document = original.document;
    Date.now = original.now;
  }
});
