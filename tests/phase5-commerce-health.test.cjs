const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NextRequest, NextResponse } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");

test("commerce health denies non-admin before reading private operations", async () => {
  const route = loadSource("src/app/api/admin/commerce/route.ts", {
    "@/lib/supabase/requireAdmin": { requireAdmin: async () => ({ error: NextResponse.json({ error: "admin required" }, { status: 403 }) }) },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => { throw new Error("Must not query"); } },
  });
  assert.equal((await route.GET(new NextRequest("http://local/api/admin/commerce"))).status, 403);
});

test("commerce health aggregates counts only without customer/provider credentials", async () => {
  const queries = [];
  let count = 0;
  const route = loadSource("src/app/api/admin/commerce/route.ts", {
    "@/lib/supabase/requireAdmin": { requireAdmin: async () => ({ userId: "admin" }) },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => ({ from(table) {
      const query = { table };
      const builder = { select(fields, options) { Object.assign(query, { fields, options }); return builder; }, eq(key, value) { query.eq = [key, value]; return builder; }, or(value) { query.or = value; return builder; }, in(key, value) { query.in = [key, value]; return builder; }, lt(key, value) { query.lt = [key, value]; return builder; }, then(resolve) { queries.push(query); resolve({ count: ++count, error: null }); } };
      return builder;
    } }) },
  });
  const response = await route.GET(new NextRequest("http://local/api/admin/commerce"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  const result = await response.json();
  assert.deepEqual([result.cancellationRequests, result.paymentReviews, result.unsettledMedia, result.retainedMedia], [1,2,3,4]);
  assert.equal(queries.length, 4);
  assert.ok(queries.every(query => query.options.head && query.options.count === "exact"));
  assert.equal(queries[2].lt[0], "created_at");
  assert.equal(result.secret, undefined);
});

test("commerce health never turns a database outage into a healthy zero count", async () => {
  const builder = { select() { return builder; }, eq() { return builder; }, or() { return builder; }, in() { return builder; }, lt() { return builder; }, then(resolve) { resolve({ error: { message: "secret provider details" }, count: null }); } };
  const route = loadSource("src/app/api/admin/commerce/route.ts", {
    "@/lib/supabase/requireAdmin": { requireAdmin: async () => ({ userId: "admin" }) },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => ({ from: () => builder }) },
  });
  const response = await route.GET(new NextRequest("http://local/api/admin/commerce"));
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /secret provider/);
});
