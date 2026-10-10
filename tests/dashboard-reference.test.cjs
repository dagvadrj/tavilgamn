const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");

test("merchant inventory totals preserve integer precision and unknown stock is not a low-stock alert", () => {
  const products = [
    { id: "a", name: "Тавиур", category: "storage-shelf", image: "", basePrice: Number.MAX_SAFE_INTEGER, stockQuantity: 6 },
    { id: "b", name: "Дууссан", category: "chair", image: "", basePrice: 1000, stockQuantity: 0 },
    { id: "c", name: "Тоолоогүй", category: "chair", image: "", basePrice: 1000, stockQuantity: null },
  ];
  const values = [products, false, null, 0, false];
  let index = 0;
  const { MerchantOverview } = loadSource("src/features/merchant/MerchantOverview.tsx", {
    react: { ...React, useState: () => [values[index++], () => {}], useEffect() {} },
    "@/components/MerchantAnalytics": { useMerchantAnalytics: () => ({ analytics: null, loading: false, error: null, refresh() {} }) },
  });
  const html = renderToStaticMarkup(MerchantOverview({
    owner: "owner", store: { id: "store", name: "Дэлгүүр", city: "Улаанбаатар", district: "", storeType: "retail" },
    onProducts() {}, onStore() {},
  }));
  const total = (BigInt(Number.MAX_SAFE_INTEGER) * 6n).toLocaleString("mn-MN") + " ₮";
  assert.ok(html.includes(total));
  assert.match(html, /1 бараа багассан/);
  assert.match(html, /1 нөөц тоолоогүй/);
  assert.match(html, /Бэлэн бараа/);
});

test("store spotlight metadata is read from platform columns and cannot be supplied through merchant editable fields", () => {
  const store = { id: "store", name: "Дэлгүүр", store_type: "retail", city: "Улаанбаатар", district: "", address: "Хаяг", phone: "99000000", description: "", image: "", categories: ["chair"], is_featured: true, featured_rank: 2 };
  const { merchantStoreFromRow } = loadSource("src/lib/merchantServer.ts");
  const mapped = merchantStoreFromRow(store);
  assert.equal(mapped.isFeatured, true);
  assert.equal(mapped.featuredRank, 2);
  assert.equal(merchantStoreFromRow({ ...store, featured_rank: -1 }).featuredRank, undefined);
  const { parseMerchantStore } = loadSource("src/lib/merchantValidation.ts");
  const editable = parseMerchantStore({ ...mapped, isFeatured: false, featuredRank: 99, commissionBps: 0 });
  assert.equal(editable.isFeatured, undefined);
  assert.equal(editable.featuredRank, undefined);
  assert.equal(editable.commissionBps, undefined);
});
