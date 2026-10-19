const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NextRequest, NextResponse } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");
const { executeMerchantQuery } = loadSource("src/lib/merchantGraphql.ts");
const { merchantQueryFor } = loadSource(
  "src/features/merchant/merchantQueries.ts",
);

const progress = {
  asOf: "2026-10-19T01:00:00Z",
  selectedDate: "2026-10-19",
  total: 0,
  hasMore: false,
  held: 0,
  aging: [0, 0, 0, 0],
  orders: [],
  dates: [],
  counts: {
    incoming: 0,
    preparing: 0,
    prepared: 0,
    shipped: 0,
    delivered: 0,
    completed: 0,
  },
  dayTotals: {
    orders: 0,
    paidOrders: 0,
    gross: "9007199254740993",
    net: "8106479329266894",
    completed: 0,
  },
};
const analytics = {
  periodStart: "2026-09-19",
  asOf: "2026-10-19",
  storeId: "shop",
  storeName: "Shop",
  commissionBps: 500,
  ...Object.fromEntries(
    [
      "grossRevenue",
      "platformFee",
      "merchantNet",
      "paidOrders",
      "pendingOrders",
      "processingOrders",
      "shippedOrders",
      "productCount",
      "totalStock",
      "lowStockCount",
      "modelRequestCount",
    ].map((k) => [k, "0"]),
  ),
};
const order = {
  id: "order",
  items: [
    {
      productId: "p",
      name: "Sofa",
      color: "oak",
      material: "wood",
      colorName: "Oak",
      materialName: "Wood",
      qty: 1,
      unitPrice: 100,
      lineTotal: 100,
    },
  ],
  subtotal: 100,
  delivery: { name: "Customer", phone: "12345678", address: "Private address" },
  stage: "prepared",
  version: 2,
  createdAt: "2026-10-19",
  updatedAt: "2026-10-19",
  completedAt: null,
  paymentStatus: "paid",
  cancellationStatus: null,
  driver: { id: "driver", name: "Driver", phone: "12345678", vehicle: "Car" },
  currency: "MNT",
  created_at: "2026-10-19",
  status: "processing",
  commissionBps: 500,
  platformFee: 5,
  merchantNet: 95,
};

test("all six browser query documents execute against the real typed schema", async () => {
  const calls = [];
  const rpc = async (name, args) => {
    calls.push({ name, args });
    return {
      data: {
        merchant_dashboard_progress: progress,
        merchant_dashboard_trends: {
          asOf: "2026-10-19",
          months: [{ month: "2026-10", gross: "10", net: "9", orders: 1 }],
        },
        merchant_dashboard_analytics: analytics,
        read_merchant_delivery_orders: {
          orders: [order],
          total: 1,
          hasMore: false,
        },
        read_merchant_delivery_staff: [
          { ...order.driver, active: true, version: 2 },
        ],
        read_merchant_orders: [order],
      }[name],
      error: null,
    };
  };
  for (const path of [
    "/api/merchant/dashboard?section=progress&date=2026-10-19&page=2",
    "/api/merchant/dashboard?section=trends",
    "/api/merchant/analytics",
    "/api/merchant/delivery?stage=prepared&page=1",
    "/api/merchant/delivery/staff",
    "/api/merchant/orders?page=3",
  ]) {
    const query = merchantQueryFor(path);
    const response = await executeMerchantQuery(query, "verified", rpc);
    assert.equal(response.status, 200, path);
    assert.equal(
      response.result.errors,
      undefined,
      JSON.stringify(response.result),
    );
    assert.ok(query.field in response.result.data);
  }
  assert.ok(calls.every((c) => c.args.p_actor === "verified"));
  assert.deepEqual(calls[0].args, {
    p_actor: "verified",
    p_date: "2026-10-19",
    p_page: 2,
  });
  assert.deepEqual(calls[3].args, {
    p_actor: "verified",
    p_stage: "prepared",
    p_page: 1,
  });
});

test("field selection omits private fields and exact string money survives", async () => {
  const response = await executeMerchantQuery(
    { query: "{ progress { dayTotals { gross } } }" },
    "owner",
    async () => ({ data: progress, error: null }),
  );
  assert.deepEqual(JSON.parse(JSON.stringify(response.result.data)), {
    progress: { dayTotals: { gross: "9007199254740993" } },
  });
  const minimal = await executeMerchantQuery(
    { query: "{ orders { orders { id } } }" },
    "owner",
    async () => ({ data: [order], error: null }),
  );
  assert.deepEqual(JSON.parse(JSON.stringify(minimal.result.data)), {
    orders: { orders: [{ id: "order" }] },
  });
});

test("pagination is capped to 20 and hasMore is retained", async () => {
  const response = await executeMerchantQuery(
    { query: "{ orders(page: 2) { hasMore orders { id } } }" },
    "owner",
    async () => ({ data: Array(21).fill(order), error: null }),
  );
  assert.equal(response.result.data.orders.orders.length, 20);
  assert.equal(response.result.data.orders.hasMore, true);
});

test("bad date/page/enum, forged actor, unknown fields, mutations and multi-operation documents never reach database", async () => {
  let calls = 0;
  for (const query of [
    '{ progress(date:"2026-02-31") { total } }',
    "{ orders(page:-1) { hasMore } }",
    "{ orders(page:100001) { hasMore } }",
    "{ orders(page:null) { hasMore } }",
    "{ delivery(stage:other) { total } }",
    '{ orders(actor:"forged") { hasMore } }',
    "{ secret }",
    "mutation { orders { hasMore } }",
    "query A { staff { id } } query B { staff { id } }",
  ]) {
    const response = await executeMerchantQuery(
      { query },
      "owner",
      async () => {
        calls++;
        return { data: [], error: null };
      },
    );
    assert.ok(response.result.errors?.length, query);
  }
  assert.equal(calls, 0);
});

test("expanded aliases/fragments are bounded, ordinary fragments work and duplicate reads deduplicate per request", async () => {
  let calls = 0;
  const rpc = async () => {
    calls++;
    return { data: progress, error: null };
  };
  const response = await executeMerchantQuery(
    {
      query:
        "query { a: progress { ...P } b: progress { total } } fragment P on Progress { total }",
    },
    "owner",
    rpc,
  );
  assert.equal(response.result.errors, undefined);
  assert.equal(calls, 1);
  const big = await executeMerchantQuery(
    {
      query: `query { ...Many } fragment Many on Query { ${Array.from({ length: 9 }, (_, i) => `x${i}:progress { total }`).join(" ")} }`,
    },
    "owner",
    rpc,
  );
  assert.equal(big.status, 400);
  assert.equal(calls, 1);
  const cyclic = await executeMerchantQuery(
    { query: "query { ...A } fragment A on Query { ...A }" },
    "owner",
    rpc,
  );
  assert.equal(cyclic.status, 400);
  assert.equal(calls, 1);
});

test("an upstream failure produces partial data, hides internal details and does not poison another root", async () => {
  const response = await executeMerchantQuery(
    { query: "{ progress { total } staff { id } }" },
    "owner",
    async (name) =>
      name === "read_merchant_delivery_staff"
        ? { error: { code: "42501", message: "SECRET SQL" } }
        : { data: progress },
  );
  assert.equal(response.status, 200);
  assert.equal(response.result.data.progress.total, 0);
  assert.equal(response.result.data.staff, null);
  assert.equal(response.result.errors[0].extensions.code, "FORBIDDEN");
  assert.ok(!JSON.stringify(response).includes("SECRET"));
  const thrown = await executeMerchantQuery(
    { query: "{ staff { id } }" },
    "owner",
    async () => {
      throw Error("SECRET CONNECTION");
    },
  );
  assert.ok(!JSON.stringify(thrown).includes("SECRET"));
});

test("independent GraphQL requests expose fast data while a different request is pending", async () => {
  let finish;
  const slow = executeMerchantQuery(
    { query: "{ trends { asOf } }" },
    "owner",
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const fast = await executeMerchantQuery(
    { query: "{ progress { total } }" },
    "owner",
    async () => ({ data: progress }),
  );
  assert.equal(fast.result.data.progress.total, 0);
  finish({ data: { asOf: "now" } });
  assert.equal((await slow).result.data.trends.asOf, "now");
});

test("HTTP authentication precedes parsing/database; body/content type budgets and standard variables are enforced", async () => {
  let authorized = false,
    calls = 0;
  const { POST } = loadSource("src/app/api/merchant/graphql/route.ts", {
    "@/lib/supabase/requireMerchant": {
      requireMerchant: async () =>
        authorized
          ? { userId: "verified" }
          : { error: NextResponse.json({ error: "login" }, { status: 401 }) },
    },
    "@/lib/supabase/admin": {
      getSupabaseAdmin: () => ({
        rpc: async (name, args) => {
          calls++;
          assert.equal(args.p_actor, "verified");
          return { data: progress };
        },
      }),
    },
  });
  const request = (body, contentType = "application/json") =>
    new NextRequest("https://local/api/merchant/graphql", {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    });
  assert.equal((await POST(request("bad"))).status, 401);
  assert.equal(calls, 0);
  authorized = true;
  assert.equal((await POST(request("{}", "text/plain"))).status, 415);
  assert.equal((await POST(request("x".repeat(33000)))).status, 413);
  for (const body of [
    "bad",
    "[]",
    "{}",
    '{"query":"{progress{total}}","variables":[]}',
    '{"query":"{progress{total}}","operationName":3}',
  ])
    assert.equal((await POST(request(body))).status, 400);
  const response = await POST(
    request(
      JSON.stringify({
        query: "query P($date:String){progress(date:$date){total}}",
        variables: { date: "2026-10-19", p_actor: "forged" },
        operationName: "P",
      }),
    ),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-type"), /graphql-response/);
  assert.equal(calls, 1);
});

test("browser transport sends GraphQL reads, preserves write API and rejects errors and late account results", async () => {
  let actor = "alice",
    payload = { data: { orders: { orders: [], hasMore: false } } },
    ok = true;
  const calls = [];
  const { merchantRequest } = loadSource(
    "src/features/merchant/merchantApi.ts",
    {
      "@/store/auth": {
        useAuth: {
          getState: () => ({ user: { id: actor }, role: "merchant" }),
        },
      },
      "@/lib/authFetch": {
        authFetch: async (path, init, owner) => {
          calls.push({ path, init, owner });
          return { ok, json: async () => payload };
        },
      },
    },
  );
  const controller = new AbortController();
  assert.deepEqual(
    await merchantRequest("/api/merchant/orders?page=2", "alice", {
      signal: controller.signal,
    }),
    { orders: [], hasMore: false },
  );
  assert.equal(calls[0].path, "/api/merchant/graphql");
  assert.equal(calls[0].init.signal, controller.signal);
  assert.equal(calls[0].owner, "alice");
  assert.deepEqual(JSON.parse(calls[0].init.body).variables, { page: 2 });
  payload = { ok: true };
  await merchantRequest("/api/merchant/delivery", "alice", {
    method: "PATCH",
    body: "{}",
  });
  assert.equal(calls[1].path, "/api/merchant/delivery");
  payload = { data: { orders: null }, errors: [{ message: "retry" }] };
  await assert.rejects(
    merchantRequest("/api/merchant/orders", "alice"),
    /retry/,
  );
  ok = false;
  await assert.rejects(
    merchantRequest("/api/merchant/orders", "alice"),
    /retry/,
  );
  actor = "bob";
  const before = calls.length;
  await assert.rejects(
    merchantRequest("/api/merchant/orders", "alice"),
    /Нэвтрэлт/,
  );
  assert.equal(calls.length, before);
});

test("a response from the previous merchant is discarded even after a successful HTTP reply", async () => {
  let actor = "alice",
    finish;
  const { merchantRequest } = loadSource(
    "src/features/merchant/merchantApi.ts",
    {
      "@/store/auth": {
        useAuth: {
          getState: () => ({ user: { id: actor }, role: "merchant" }),
        },
      },
      "@/lib/authFetch": {
        authFetch: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
    },
  );
  const result = merchantRequest("/api/merchant/orders", "alice");
  actor = "bob";
  finish({
    ok: true,
    json: async () => ({
      data: { orders: { orders: [{ id: "private" }], hasMore: false } },
    }),
  });
  await assert.rejects(result, /Нэвтрэлт/);
});
