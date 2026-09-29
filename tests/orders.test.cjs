const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { NextRequest, NextResponse } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");
const validation = loadSource("src/lib/orderValidation.ts");
const orders = loadSource("src/lib/orders.ts");
const products = loadSource("src/lib/products.ts");
const modelOptions = loadSource("src/lib/modelOptions.ts");
const item = { productId: "halden-sofa", color: "sage", material: "fabric", qty: 1 };
const delivery = { name: "Test buyer", phone: "99001122", address: "Test district, building 1, apartment 2" };
const body = () => ({ items: [item], delivery, expectedTotal: 1899000, idempotencyKey: randomUUID() });
const catalogRows = [
  {id: "halden-sofa", name: "Fixture sofa", basePrice: 1899000, category: "sofa", defaultColor: "sage", colors: [{id: "sage", name: "Sage", hex: "#808080", priceDelta: 0}], materials: [{id: "fabric", name: "Fabric", priceDelta: 0}]},
  {id: "ergo-chair", name: "Fixture chair", basePrice: 599000, category: "office", defaultColor: "clay", colors: [{id: "clay", name: "Clay", hex: "#808080", priceDelta: 30}], materials: [{id: "leather", name: "Leather", priceDelta: 220}]},
].map(data => ({id: data.id, data: {description: "", image: "/test.jpg", dimensions: {w:1,d:1,h:1}, rating: 0, reviewCount: 0, ...data, stockQuantity: 1000, inStock: true}}));
const toFurniture = ({id,data}) => ({id: randomUUID(),product_id:id,name:data.name,category:data.category,description:data.description,
  base_price:data.basePrice,image_url:data.image,glb_path:null,thumbnail_path:null,scale:1,dimensions_w:data.dimensions.w,dimensions_d:data.dimensions.d,dimensions_h:data.dimensions.h,
  colors:data.colors,materials:data.materials,default_color:data.defaultColor,in_stock:data.stockQuantity,rating:data.rating,review_count:data.reviewCount});
const catalogDb = (rows = catalogRows) => ({ from(table) { assert.equal(table, "furniture_models"); return {select: () => ({in: async (_field, ids) => ({data: rows.filter(row => ids.includes(row.id)).map(toFurniture), error: null})})}; } });
const service = loadSource("src/lib/orderService.ts", {
  "server-only": {}, "./products": products, "./modelOptions": modelOptions,
  "./orderValidation": validation, "./orders": orders, "./supabase/admin": { getSupabaseAdmin: () => catalogDb() },
});

test("checkout rejects malformed quantities, variants, and missing delivery", () => {
  for (const qty of [0, -1, 100, 1.5, "1", null, NaN, Infinity]) {
    assert.throws(() => validation.parseSelections([{ ...item, qty }]), validation.OrderInputError);
  }
  for (const items of [[], null, [null], [{ ...item, material: "gold" }], [{ ...item, productId: "../admin" }]]) {
    assert.throws(() => validation.parseSelections(items), validation.OrderInputError);
  }
  assert.throws(() => validation.parseDelivery({ ...delivery, phone: "--------" }), validation.OrderInputError);
  assert.throws(() => validation.parseOrderBody({ ...body(), idempotencyKey: "bad" }), validation.OrderInputError);
  assert.throws(() => validation.parseOrderBody({ ...body(), expectedTotal: -1 }), validation.OrderInputError);
});
test("duplicate variants merge without bypassing the quantity cap", () => {
  assert.equal(validation.parseSelections([item, { ...item, qty: 2 }])[0].qty, 3);
  assert.throws(() => validation.parseSelections([{ ...item, qty: 99 }, item]), validation.OrderInputError);
});
test("server ignores customer-supplied price and calculates variant prices and shipping", async () => {
  const clean = validation.parseSelections([{ ...item, unitPrice: 1, name: "Forged", qty: 2 }]);
  const quote = await service.quoteOrder(clean);
  assert.equal(quote.subtotal, 3798000);
  assert.equal(quote.shipping, 0);
  assert.equal(quote.items[0].name, catalogRows[0].data.name);
  const small = await service.quoteOrder([{ productId: "ergo-chair", color: "clay", material: "leather", qty: 1 }]);
  assert.equal(small.items[0].unitPrice, 599000 + 30 + 220);
  assert.equal(small.shipping, 49000);
  assert.equal(orders.shippingFor(1500000), 0);
  await assert.rejects(service.quoteOrder([{ ...item, color: "missing" }]), validation.OrderInputError);
  await assert.rejects(service.quoteOrder([{ ...item, productId: "missing" }]), validation.OrderInputError);
});
test("catalog products use database price/options and reject insufficient or deleted stock", async () => {
  const product = {...catalogRows[0].data, id: randomUUID(), name: "Uploaded", basePrice: 500000, stockQuantity: 2,
    colors: [{id: "oak", name: "Oak", hex: "#C9A37A", priceDelta: 1000}], defaultColor: "oak",
    materials: [{id: "wood", name: "Wood", priceDelta: 2000}]};
  const rows = [{id: product.id, data: product}];
  const selections = [{productId: product.id, color: "oak", material: "wood", qty: 1}];
  assert.equal((await service.quoteOrder(selections, catalogDb(rows))).total, 552000);
  await assert.rejects(service.quoteOrder([{...selections[0], qty: 3}], catalogDb(rows)), validation.OrderInputError);
  product.stockQuantity = 0;
  await assert.rejects(service.quoteOrder(selections, catalogDb(rows)), validation.OrderInputError);
  await assert.rejects(service.quoteOrder(selections, catalogDb([])), validation.OrderInputError);
});

// A service-boundary fake enforces the unique key and filters used by the routes.
function orderDatabase() {
  const rows = [];
  return { rows, from(table) {
    if (table === "furniture_models") return catalogDb().from(table);
    assert.equal(table, "orders");
    let filters = [], insert = null;
    const query = {
      select() { return query; },
      eq(field, value) { filters.push([field, value]); return query; },
      order() { return query; },
      insert(value) { insert = value; return query; },
      async maybeSingle() { return { data: rows.find((row) => filters.every(([key, value]) => row[key] === value)) ?? null, error: null }; },
      async range(start, end) { return { data: rows.filter((row) => filters.every(([key, value]) => row[key] === value)).slice(start, end + 1), error: null }; },
      async single() {
        if (rows.some((row) => row.user_id === insert.user_id && row.idempotency_key === insert.idempotency_key)) return { data: null, error: { code: "23505" } };
        const row = { id: randomUUID(), created_at: new Date().toISOString(), ...insert };
        rows.push(row);
        return { data: row, error: null };
      },
    };
    return query;
  } };
}
function routeFor(db, userId = "user-a") {
  return loadSource("src/app/api/orders/route.ts", {
    "@/lib/supabase/requireUser": { requireUser: async () => userId ? { userId, error: null } : { userId: null, error: NextResponse.json({}, { status: 401 }) } },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
    "@/lib/orderValidation": validation, "@/lib/orderService": service,
  });
}
function request(payload) { return new NextRequest("http://localhost/api/orders", { method: "POST", body: JSON.stringify(payload) }); }
test("unauthenticated requests cannot create or list orders", async () => {
  const db = orderDatabase();
  assert.equal((await routeFor(db, null).POST(request(body()))).status, 401);
  assert.equal((await routeFor(db, null).GET(new NextRequest("http://localhost/api/orders"))).status, 401);
  assert.equal(db.rows.length, 0);
});
test("changed prices require customer confirmation without persisting an order", async () => {
  const db = orderDatabase();
  const response = await routeFor(db).POST(request({ ...body(), expectedTotal: 1, user_id: "victim", status: "paid" }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "PRICE_CHANGED");
  assert.equal(db.rows.length, 0);
});
test("same request retries create one pending order, never trust user identity/status", async () => {
  const db = orderDatabase();
  const route = routeFor(db);
  const payload = { ...body(), user_id: "victim", status: "paid", total: 1 };
  assert.equal((await route.POST(request(payload))).status, 201);
  assert.equal((await route.POST(request(payload))).status, 200);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].user_id, "user-a");
  assert.equal(db.rows[0].status, "pending_payment");
  assert.equal(db.rows[0].total, 1899000);
  const conflict = await route.POST(request({ ...payload, delivery: { ...delivery, name: "Changed buyer" } }));
  assert.equal(conflict.status, 409);
});
test("concurrent duplicate requests resolve to the same persisted order", async () => {
  const db = orderDatabase();
  const payload = body();
  const route = routeFor(db);
  const responses = await Promise.all([route.POST(request(payload)), route.POST(request(payload))]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [200, 201]);
  assert.equal(db.rows.length, 1);
});
test("order history is scoped to the authenticated user regardless of supplied query filters", async () => {
  const db = orderDatabase();
  await routeFor(db, "user-a").POST(request(body()));
  await routeFor(db, "user-b").POST(request(body()));
  const response = await routeFor(db, "user-b").GET(new NextRequest("http://localhost/api/orders?user_id=user-a"));
  assert.equal(response.headers.get("cache-control"), "no-store");
  const result = await response.json();
  assert.equal(result.orders.length, 1);
  assert.equal(result.orders[0].user_id, "user-b");
});
test("requireUser verifies bearer token with Supabase instead of trusting browser identity", async () => {
  let received;
  const { requireUser } = loadSource("src/lib/supabase/requireUser.ts", {
    "server-only": {}, "./admin": { getSupabaseAdmin: () => ({ auth: { getUser: async (token) => { received = token; return { data: { user: { id: "verified" } }, error: null }; } } }) },
  });
  assert.equal((await requireUser(new NextRequest("http://localhost"))).error.status, 401);
  assert.equal(received, undefined);
  const result = await requireUser(new NextRequest("http://localhost", { headers: { Authorization: "Bearer signed-token" } }));
  assert.equal(result.userId, "verified");
  assert.equal(received, "signed-token");
});
