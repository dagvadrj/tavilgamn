const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NextRequest, NextResponse } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");

test("merchant authentication ignores forged metadata and checks current role on every request", async () => {
  let role = "customer", error = null, reads = 0;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: "actor", user_metadata: { role: "merchant" } } }, error: null }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => { reads++; return { data: { role }, error }; } }) }) }),
  };
  const { requireMerchant } = loadSource("src/lib/supabase/requireMerchant.ts", { "./admin": { getSupabaseAdmin: () => db } });
  const request = new NextRequest("http://local/api/merchant/orders", { headers: { authorization: "Bearer test" } });
  assert.equal((await requireMerchant(new NextRequest(request.url))).error.status, 401);
  assert.equal(reads, 0);
  assert.equal((await requireMerchant(request)).error.status, 403);
  role = "merchant";
  assert.equal((await requireMerchant(request)).userId, "actor");
  role = "customer";
  assert.equal((await requireMerchant(request)).error.status, 403);
  error = { code: "outage" };
  assert.equal((await requireMerchant(request)).error.status, 503);
});

test("every merchant route rejects unauthenticated access before database work", async () => {
  for (const [path, methods] of [["store", ["GET", "PUT"]], ["products", ["GET", "POST", "PUT"]], ["orders", ["GET", "PATCH"]]]) {
    const routes = loadSource(`src/app/api/merchant/${path}/route.ts`, {
      "@/lib/supabase/requireMerchant": { requireMerchant: async () => ({ error: NextResponse.json({ error: "login" }, { status: 401 }) }) },
      "@/lib/supabase/admin": { getSupabaseAdmin: () => { throw new Error("Must not query database"); } },
    });
    for (const method of methods) assert.equal((await routes[method](new NextRequest(`http://local/api/merchant/${path}`, { method }))).status, 401);
  }
});

test("order requests bind the authenticated actor, reject malformed statuses, and surface conflicts", async () => {
  const calls = [];
  let rpcError = null;
  const route = loadSource("src/app/api/merchant/orders/route.ts", {
    "@/lib/supabase/requireMerchant": { requireMerchant: async () => ({ userId: "verified-owner", error: null }) },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => ({ rpc: async (name, args) => { calls.push({ name, args }); return { data: Array.from({ length: 21 }, (_, i) => ({ id: i })), error: rpcError }; } }) },
  });
  const id = "12345678-1234-1234-1234-123456789abc";
  const patch = value => route.PATCH(new NextRequest("http://local/api/merchant/orders", { method: "PATCH", body: JSON.stringify(value) }));
  assert.equal((await patch({ id, status: ["processing"], expectedStatus: "pending" })).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await patch({ id, status: "processing", expectedStatus: "pending", ownerId: "other-owner", storeId: "other-store" })).status, 200);
  assert.deepEqual(calls[0].args, { p_actor: "verified-owner", p_order: id, p_status: "processing", p_expected_status: "pending" });
  rpcError = { code: "P0009", message: "private database details" };
  const response = await patch({ id, status: "shipped", expectedStatus: "processing" });
  assert.equal(response.status, 409);
  assert.ok(!(await response.text()).includes("private database details"));
  rpcError = null;
  const page = await route.GET(new NextRequest("http://local/api/merchant/orders?page=1&ownerId=other-owner"));
  assert.equal(page.headers.get("cache-control"), "private, no-store");
  const data = await page.json();
  assert.equal(data.orders.length, 20); assert.equal(data.hasMore, true);
  assert.deepEqual(calls.at(-1).args, { p_actor: "verified-owner", p_page: 1 });
});

test("merchant login return survives registration without accepting external redirects", () => {
  const storage = new Map();
  const previous = global.sessionStorage;
  global.sessionStorage = { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  try {
    const auth = loadSource("src/lib/authRedirect.ts");
    assert.equal(auth.rememberAuthDestination("?next=/merchant"), "/merchant");
    assert.equal(auth.rememberAuthDestination(""), "/merchant");
    for (const next of ["https://evil.example", "//evil.example", "/merchant/../admin", "/merchant?next=evil"]) assert.equal(auth.authDestination(`?next=${encodeURIComponent(next)}`), "/account");
  } finally { global.sessionStorage = previous; }
});
