const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");

const order = { id: "id", status: "paid", total: 149000, items: [], currency: "MNT", subtotal: 100000, shipping: 49000, delivery: {}, created_at: "2026-10-02T01:00:00Z" };
const cancellation = { order_id: "id", status: "approved", reason: "Тест шалтгаан", requested_at: order.created_at, review_note: "Хүлээн авсан", refund_reference: null, refunded_at: null };
const operations = loadSource("src/lib/commerceOperations.ts");
const ui = loadSource("src/components/CommerceOrderActions.tsx", { "@/store/auth": { useAuth: selector => selector({ user: { id: "actor" } }) } });

test("cancellation UI never equates approval with refunded money", () => {
  const html = renderToStaticMarkup(React.createElement(ui.CancellationSummary, { cancellation, paid: true }));
  assert.match(html, /Цуцлалтыг зөвшөөрсөн/);
  assert.match(html, /мөнгө буцсан гэсэн үг биш/);
  assert.doesNotMatch(html, /Төлбөрийн буцаалт бүртгэгдсэн/);
  const refunded = renderToStaticMarkup(React.createElement(ui.CancellationSummary, { cancellation: { ...cancellation, status: "refunded", refund_reference: "TEST-REF-1", refunded_at: order.created_at }, paid: true }));
  assert.match(refunded, /TEST-REF-1/);
  assert.match(refunded, /Төлбөрийн буцаалт бүртгэгдсэн/);
});

test("new payment blocked for pending/approved/refunded cancellation but not rejected", () => {
  for (const status of ["requested", "approved", "refunded"]) assert.equal(operations.cancellationBlocksPayment({ order_cancellations: { ...cancellation, status } }), true);
  assert.equal(operations.cancellationBlocksPayment({ order_cancellations: { ...cancellation, status: "rejected" } }), false);
  for (const status of ["shipped", "delivered", "cancelled"]) assert.equal(operations.canRequestCancellation({ ...order, status }), false);
  assert.equal(operations.canRequestCancellation(order), true);
  assert.equal(operations.canRequestCancellation({ ...order, order_cancellations: cancellation }), false);
});

test("admin refund form requires full amount and actual transfer proof", () => {
  const html = renderToStaticMarkup(React.createElement(ui.AdminOrderOperations, { order: { ...order, order_cancellations: cancellation }, paymentState: "paid", onUpdated: async () => {} }));
  assert.match(html, /Энэ товч мөнгө шилжүүлэхгүй/);
  assert.match(html, /Буцаалтын гүйлгээний дугаар/);
  assert.match(html, /min="149000" max="149000"/);
  assert.match(html, /Бодит буцаалтыг бүртгэх/);
  assert.match(html, /type="checkbox" required/);
});

test("customer fulfillment summary contains only delivery data, not merchant settlement", () => {
  const mixed = { ...order, platform_fulfillment_status: "pending", merchant_order_fulfillments: [{ store_id: "s", status: "shipped", items: [{ name: "Тест бараа", qty: 1 }], subtotal: 100000, platform_fee: 5000, merchant_net: 95000, commission_bps: 500 }] };
  const html = renderToStaticMarkup(React.createElement(ui.OrderFulfillmentSummary, { order: mixed }));
  assert.match(html, /Платформын илгээмж/);
  assert.match(html, /Хүргэлтэд гарсан/);
  assert.doesNotMatch(html, /Шимтгэл/);
  const admin = renderToStaticMarkup(React.createElement(ui.OrderFulfillmentSummary, { order: mixed, admin: true }));
  assert.match(admin, /Шимтгэл/);
});
