const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");
const { STORES } = loadSource("src/lib/stores.ts");

function merchantRow(id, overrides = {}) {
  return {
    id, name: `Дэлгүүр ${id}`, store_type: "handmade", active: true,
    city: "Улаанбаатар", district: "Хан-Уул", address: "Хаяг", phone: "99001122",
    description: "Гар хийцийн тавилга", image: "", categories: ["sofa", "bookshelf"],
    owner_id: "private-owner-uuid", created_at: "2026-09-16", ...overrides,
  };
}

function directoryHarness(rows = [], errors = new Map()) {
  const queries = [];
  const db = {
    from(table) {
      const query = { table, filters: [] };
      queries.push(query);
      const builder = {
        select(fields) { query.fields = fields.split(","); return builder; },
        eq(field, value) { query.filters.push([field, value]); return builder; },
        order(field) { query.order = field; return builder; },
        async range(start, end) {
          query.range = [start, end];
          if (errors.has(start)) return { data: null, error: errors.get(start) };
          // Return all row fields so the public mapper is independently checked,
          // even if an upstream database projection were accidentally broadened.
          const filtered = rows.filter(row => query.filters.every(([key, value]) => row[key] === value));
          filtered.sort((a, b) => a[query.order].localeCompare(b[query.order]));
          return { data: filtered.slice(start, end + 1), error: null };
        },
      };
      return builder;
    },
  };
  return { queries, ...loadSource("src/lib/storeDirectory.ts", { "./supabase/admin": { getSupabaseAdmin: () => db } }) };
}

test("public directory preserves existing stores, excludes inactive merchants and private account fields", async () => {
  const harness = directoryHarness([
    merchantRow("merchant-visible"), merchantRow("merchant-hidden", { active: false }),
    merchantRow("merchant-invalid", { store_type: "admin" }),
  ]);
  const directory = await harness.readStoreDirectory();
  for (const store of STORES) assert.deepEqual(directory.find(item => item.id === store.id), store);
  assert.equal(directory.length, STORES.length + 1);
  const visible = directory.find(store => store.id === "merchant-visible");
  assert.equal(visible.storeType, "handmade");
  assert.deepEqual(visible.categories, ["sofa", "bookshelf"]);
  assert.ok(!Object.hasOwn(visible, "owner_id"));
  assert.ok(!Object.hasOwn(visible, "created_at"));
  assert.ok(!Object.hasOwn(visible, "active"));
  assert.equal(harness.queries[0].table, "merchant_stores");
  assert.deepEqual(harness.queries[0].filters, [["active", true]]);
  assert.ok(!harness.queries[0].fields.includes("owner_id"));
  assert.ok(!harness.queries[0].fields.includes("*"));
});

test("directory pagination keeps all stores beyond a response limit and filters bad category data", async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => merchantRow(`merchant-${String(index).padStart(4, "0")}`));
  rows[0].categories = ["sofa", "not-a-category", null, 9];
  rows[1].categories = null;
  const harness = directoryHarness(rows);
  const directory = await harness.readStoreDirectory();
  assert.equal(directory.length, STORES.length + 1001);
  assert.equal(new Set(directory.map(store => store.id)).size, directory.length);
  assert.deepEqual(directory.find(store => store.id === rows[0].id).categories, ["sofa"]);
  assert.deepEqual(directory.find(store => store.id === rows[1].id).categories, []);
  assert.deepEqual(harness.queries.map(query => query.range), [[0, 499], [500, 999], [1000, 1499]]);
  assert.ok(harness.queries.every(query => query.order === "id"));
  assert.ok(harness.queries.every(query => query.filters.some(([key, value]) => key === "active" && value === true)));
});

test("admin directory can include inactive stores while public detail lookup cannot expose them", async () => {
  const harness = directoryHarness([merchantRow("merchant-visible"), merchantRow("merchant-hidden", { active: false })]);
  const admin = await harness.readStoreDirectory({ includeInactive: true });
  assert.ok(admin.some(store => store.id === "merchant-hidden"));
  assert.deepEqual(harness.queries[0].filters, []);
  assert.equal(await harness.readDirectoryStore("merchant-hidden"), undefined);
  assert.equal((await harness.readDirectoryStore("merchant-visible")).id, "merchant-visible");
  assert.equal(await harness.readDirectoryStore("unknown-store"), undefined);
});

test("only a not-yet-migrated table falls back to existing stores; outages remain errors", async () => {
  for (const code of ["42P01", "PGRST205"]) {
    const harness = directoryHarness([], new Map([[0, { code, message: "not migrated" }]]));
    assert.deepEqual(await harness.readStoreDirectory(), STORES);
  }
  for (const code of ["42501", "PGRST301", "ECONNRESET", "XX000"]) {
    const error = { code, message: "database error" };
    const harness = directoryHarness([], new Map([[0, error]]));
    await assert.rejects(harness.readStoreDirectory(), failure => failure === error);
  }
  const error = { code: "ECONNRESET", message: "connection lost after first page" };
  const rows = Array.from({ length: 501 }, (_, index) => merchantRow(`page-${index}`));
  await assert.rejects(directoryHarness(rows, new Map([[500, error]])).readStoreDirectory(), failure => failure === error);
});

test("room catalog links initialize matching filters while category links take precedence", () => {
  let captured;
  const { CatalogView } = loadSource("src/components/CatalogView.tsx", {
    "next/link": { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
    "./CatalogProducts": { CatalogProducts: props => { captured = props; return React.createElement("div"); } },
  });
  const living = renderToStaticMarkup(React.createElement(CatalogView, { initialRoom: "living", initialQuery: "мод", initialSort: "price-asc" }));
  assert.deepEqual(captured.categories, ["sofa", "tv-stand", "bookshelf"]);
  assert.equal(captured.query, "мод");
  assert.equal(captured.initialSort, "price-asc");
  assert.match(living, /Зочны өрөө/);
  renderToStaticMarkup(React.createElement(CatalogView, { initialRoom: "living", initialCategory: "bed" }));
  assert.deepEqual(captured.categories, ["bed"]);
  renderToStaticMarkup(React.createElement(CatalogView, { initialRoom: "unknown" }));
  assert.deepEqual(captured.categories, []);
});
