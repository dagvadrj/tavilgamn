const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { NextRequest, NextResponse } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");
const validation = loadSource("src/lib/orderValidation.ts");
const paymentTypes = loadSource("src/lib/payments.ts");
const id = "08b1bb43-b292-4d1b-9b61-53304e424435";
const callbackToken = "a".repeat(64);

function loadProviders() {
  return loadSource("src/lib/payments/providers.ts", { "server-only": {}, "../orderValidation": validation });
}
const environment = {
  APP_URL: "https://shop.example", QPAY_BASE_URL: "https://qpay.example",
  QPAY_USERNAME: "test-merchant", QPAY_PASSWORD: "test-only", QPAY_INVOICE_CODE: "TEST",
  SOCIALPAY_BASE_URL: "https://socialpay.example", SOCIALPAY_BEARER_TOKEN: "test-token", SOCIALPAY_SECRET: "test-secret",
  BANK_NAME: "Test bank", BANK_ACCOUNT: "TEST-IBAN", BANK_ACCOUNT_HOLDER: "Test merchant",
};
async function withEnvironment(run) {
  const previous = Object.fromEntries(Object.keys(environment).map((key) => [key, process.env[key]]));
  const originalFetch = global.fetch;
  Object.assign(process.env, environment);
  try { await run(); } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } }); }
const sign = (value) => createHmac("sha256", "test-secret").update(value).digest("hex");

test("payment availability requires complete server configuration", () => withEnvironment(async () => {
  const providers = loadProviders();
  assert.equal(providers.paymentConfigured("qpay"), true);
  assert.equal(providers.paymentConfigured("socialpay"), true);
  assert.equal(providers.paymentConfigured("bank_transfer"), true);
  delete process.env.QPAY_PASSWORD;
  assert.equal(providers.paymentConfigured("qpay"), false);
  process.env.APP_URL = "http://insecure.example";
  assert.equal(providers.paymentConfigured("socialpay"), false);
}));
test("QPay invoice uses stored amount, unique order reference, secret callback and reuses token", () => withEnvironment(async () => {
  let tokenCalls = 0, invoiceCalls = 0;
  global.fetch = async (url, init) => {
    if (url.endsWith("/v2/auth/token")) { tokenCalls++; return json({ access_token: "access", expires_in: Math.floor(Date.now() / 1000) + 3600 }); }
    assert.ok(url.endsWith("/v2/invoice")); invoiceCalls++;
    const request = JSON.parse(init.body);
    assert.equal(init.headers.Authorization, "Bearer access");
    assert.equal(request.amount, 123000);
    assert.equal(request.sender_invoice_no, id);
    assert.equal(request.allow_partial, false);
    assert.ok(request.callback_url.includes(callbackToken));
    return json({ invoice_id: "provider-invoice", qr_image: "cG5n", qPay_shortUrl: "https://qpay.example/pay/1" });
  };
  const providers = loadProviders();
  const result = await providers.createPayment("qpay", id, 123000, callbackToken);
  assert.equal(result.invoiceId, "provider-invoice");
  assert.equal(result.instructions.qrImage, "data:image/png;base64,cG5n");
  await providers.createPayment("qpay", id, 123000, callbackToken);
  assert.equal(tokenCalls, 1);
  assert.equal(invoiceCalls, 2);
}));
test("QPay verification rejects partial, unpaid and wrong-currency results", () => withEnvironment(async () => {
  let row = { payment_id: "payment-1", payment_status: "PAID", payment_currency: "USD", payment_amount: "123000" };
  global.fetch = async (url, init) => {
    if (url.endsWith("/v2/auth/token")) return json({ access_token: "access", expires_in: 3600 });
    assert.equal(JSON.parse(init.body).object_id, "invoice-1");
    return json({ rows: [row] });
  };
  const providers = loadProviders();
  assert.equal(await providers.verifyPayment("qpay", id, "invoice-1", 123000), null);
  row.payment_currency = "MNT"; row.payment_amount = 122999;
  assert.equal(await providers.verifyPayment("qpay", id, "invoice-1", 123000), null);
  row.payment_amount = 123000; row.payment_status = "NEW";
  assert.equal(await providers.verifyPayment("qpay", id, "invoice-1", 123000), null);
  row.payment_status = "PAID";
  assert.equal(await providers.verifyPayment("qpay", id, "invoice-1", 123000), "payment-1");
}));
test("SocialPay creation signs amount and callback and rejects forged invoice responses", () => withEnvironment(async () => {
  let forged = false;
  global.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    assert.equal(request.amount, "123000.00");
    assert.equal(request.checksum, sign(id + "123000.00GET" + request.callback));
    assert.equal(request.genToken, "N");
    return json({ invoice: "invoice-2", transactionId: id, checksum: forged ? "0".repeat(64) : sign("invoice-2" + id) });
  };
  const providers = loadProviders();
  assert.equal((await providers.createPayment("socialpay", id, 123000, callbackToken)).instructions.url, "https://socialpay.example/socialpay/MN/invoice-2");
  forged = true;
  await assert.rejects(providers.createPayment("socialpay", id, 123000, callbackToken));
}));
test("SocialPay settlement requires the matching transaction, exact amount and valid response HMAC", () => withEnvironment(async () => {
  let response = { transactionId: id, errorCode: "000", amount: "123000.00", checksum: sign(id + "000123000.00") };
  global.fetch = async (_url, init) => {
    assert.equal(JSON.parse(init.body).checksum, sign(id + id));
    return json(response);
  };
  const providers = loadProviders();
  assert.equal(await providers.verifyPayment("socialpay", id, "invoice", 123000), id);
  response.amount = "1.00"; response.checksum = sign(id + "0001.00");
  await assert.rejects(providers.verifyPayment("socialpay", id, "invoice", 123000));
  response.amount = "123000.00"; response.checksum = "0".repeat(64);
  await assert.rejects(providers.verifyPayment("socialpay", id, "invoice", 123000));
}));
test("bank transfer instructions never automatically confirm payment", () => withEnvironment(async () => {
  global.fetch = () => { assert.fail("Bank transfer must not make provider calls"); };
  const providers = loadProviders();
  const result = await providers.createPayment("bank_transfer", id, 123000, callbackToken);
  assert.equal(result.instructions.bank.reference, id);
  assert.equal(result.instructions.bank.account, "TEST-IBAN");
  assert.equal(await providers.verifyPayment("bank_transfer", id, id, 123000), null);
}));

test("SocialPay push notifications require a valid signed transaction and amount", () => withEnvironment(async () => {
  const providers = loadProviders();
  const message = { transactionId: id, amount: "123000.00", errorCode: "000", checksum: sign(id + "000123000.00") };
  assert.deepEqual(providers.verifySocialpayNotification(message), { orderId: id, amount: 123000 });
  assert.equal(providers.verifySocialpayNotification({ ...message, amount: "1.00" }), null);
  assert.equal(providers.verifySocialpayNotification({ ...message, checksum: "0".repeat(64) }), null);
  assert.equal(providers.verifySocialpayNotification({ ...message, errorCode: "FAILED" }), null);
}));

test("callbacks ignore claimed paid status and only settle after provider verification", async () => {
  let verified = null, confirms = 0;
  const db = {
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; },
        async maybeSingle() { return { data: { method: "qpay", callback_token: callbackToken, invoice_id: "invoice", state: "ready" }, error: null }; },
        async single() { assert.equal(table, "orders"); return { data: { total: 123000 }, error: null }; },
      }; return query;
    },
    async rpc(name, args) { assert.equal(name, "confirm_order_payment"); assert.equal(args.p_amount, 123000); confirms++; return { error: null }; },
  };
  const route = loadSource("src/app/api/payments/callback/[method]/[id]/route.ts", {
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
    "@/lib/payments/providers": { verifyPayment: async () => verified },
  });
  const params = { params: { method: "qpay", id } };
  const request = (token) => new NextRequest(`https://shop.example/api/payments/callback/qpay/${id}?token=${token}&status=paid`);
  assert.equal((await route.GET(request("b".repeat(64)), params)).status, 401);
  assert.equal((await route.GET(request(callbackToken), params)).status, 200);
  assert.equal(confirms, 0);
  verified = "payment-123";
  assert.equal((await route.GET(request(callbackToken), params)).status, 200);
  assert.equal(confirms, 1);
});
test("non-admin cannot manually mark a bank transfer paid", async () => {
  const route = loadSource("src/app/api/admin/orders/[id]/confirm-transfer/route.ts", {
    "@/lib/supabase/requireAdmin": { requireAdmin: async () => ({ error: NextResponse.json({}, { status: 403 }) }) },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => { assert.fail("Forbidden request must not touch orders"); } },
    "@/lib/orderValidation": validation,
  });
  assert.equal((await route.POST(new NextRequest("https://shop.example", { method: "POST", body: "{}" }), { params: { id } })).status, 403);
});
test("uncertain invoice creation is persisted and never retried as another remote invoice", async () => {
  let payment = null, calls = 0;
  const db = { from(table) {
    let update;
    const query = {
      select() { return query; }, eq() { return query; },
      async maybeSingle() { return { data: table === "orders" ? { id, total: 123000, status: "pending_payment" } : payment, error: null }; },
      async insert(value) { payment = { ...value, state: "creating", instructions: null, created_at: new Date().toISOString() }; return { error: null }; },
      update(value) { update = value; return query; },
      then(resolve) { Object.assign(payment, update); resolve({ error: null }); },
    }; return query;
  } };
  const route = loadSource("src/app/api/orders/[id]/payment/route.ts", {
    "@/lib/supabase/requireUser": { requireUser: async () => ({ userId: "owner", error: null }) },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
    "@/lib/payments": paymentTypes,
    "@/lib/payments/providers": { PaymentConfigError: class extends Error {}, validatePaymentConfig() {}, createPayment: async () => { calls++; throw new Error("Network timeout"); } },
  });
  const request = () => new NextRequest("https://shop.example", { method: "POST", body: JSON.stringify({ method: "qpay" }) });
  assert.equal((await route.POST(request(), { params: { id } })).status, 503);
  assert.equal(payment.state, "needs_review");
  assert.equal((await route.POST(request(), { params: { id } })).status, 409);
  assert.equal(calls, 1);
});
test("guest checkout transfers the basket once and keeps later owners isolated", () => {
  const storage = () => { const data = new Map(); return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }; };
  global.window = { localStorage: storage(), sessionStorage: storage() };
  try {
    const cart = loadSource("src/store/cart.ts");
    cart.useCart.getState().add({ productId: "chair", color: "oak", material: "wood", name: "Chair", image: "test", unitPrice: 10, qty: 2 });
    cart.requestGuestCartTransfer();
    cart.setCartOwner("first");
    assert.equal(cart.useCart.getState().count(), 2);
    cart.setCartOwner("first");
    assert.equal(cart.useCart.getState().count(), 2);
    cart.setCartOwner("second");
    assert.equal(cart.useCart.getState().count(), 0);
    cart.setCartOwner("first");
    assert.equal(cart.useCart.getState().count(), 2);
  } finally { delete global.window; }
});
