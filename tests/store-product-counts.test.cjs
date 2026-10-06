const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

test("store product counts paginate non-archived entries and count each product once per assigned store", async () => {
  const calls = [], cursors = [], batches = [
    { data: [{ id: "a", store_ids: ["store-1", "store-1", "store-2"] }, { id: "b", store_ids: ["store-1"] }, { id: "c", store_ids: null }, ...Array.from({ length: 497 }, (_, index) => ({ id: `c${String(index).padStart(3, "0")}`, store_ids: null }))], error: null },
    { data: [{ id: "d", store_ids: ["store-2"] }], error: null },
    { data: [], error: null },
  ];
  const db = { from(table) {
    assert.equal(table, "furniture_models");
    return { select(fields) { calls.push(fields); return this; }, is(field, value) { assert.equal(field, "archived_at"); assert.equal(value, null); return this; },
      order(field) { assert.equal(field, "id"); return this; }, limit(value) { assert.equal(value, 500); return this; },
      gt(field, value) { assert.equal(field, "id"); cursors.push(value); return this; }, then(resolve) { resolve(batches.shift()); } };
  } };
  const { readStoreProductCounts } = loadSource("src/lib/storeDirectory.ts");
  assert.deepEqual([...await readStoreProductCounts(db)], [["store-1", 2], ["store-2", 2]]);
  assert.deepEqual(cursors, ["c496"]);
  assert.deepEqual(calls, Array(2).fill("id,store_ids"));
});

test("store product counts propagate database failures instead of fabricating zero totals", async () => {
  const error = new Error("offline");
  const query = { select() { return this; }, is() { return this; }, order() { return this; }, limit() { return Promise.resolve({ data: null, error }); } };
  const { readStoreProductCounts } = loadSource("src/lib/storeDirectory.ts");
  await assert.rejects(readStoreProductCounts({ from: () => query }), error);
});

test("store cards show actual furniture counts rather than category counts, including a genuine empty catalog", async () => {
  const store = { id: "store-1", name: "Тавилгын дэлгүүр", storeType: "retail", city: "Улаанбаатар", district: "-", description: "Тавилга", image: null,
    categories: ["sofa", "bed", "wardrobe"] };
  const Page = loadSource("src/app/(shop)/stores/page.tsx", {
    "@/lib/storeDirectory": { readStoreDirectory: async () => [store, { ...store, id: "empty" }], readStoreProductCounts: async () => new Map([["store-1", 12]]) },
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
  }).default;
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  assert.ok(html.includes("12 тавилга") && html.includes("0 тавилга"));
  assert.ok(html.includes("Нийт тавилга") && html.includes("directory-card-unified"));
  assert.ok(!html.includes("3 ангилал"));
});
