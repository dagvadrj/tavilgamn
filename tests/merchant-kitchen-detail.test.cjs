const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { NextRequest, NextResponse } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");

const designId = "12345678-1234-4234-8234-123456789abc";
const versionId = "22345678-1234-4234-8234-123456789abc";
const mediaId = "32345678-1234-4234-8234-123456789abc";

test("login returns to an exact merchant kitchen detail and rejects arbitrary or external paths", () => {
  const auth = loadSource("src/lib/authRedirect.ts");
  const destination = `/merchant/kitchens/${designId}`;
  assert.equal(auth.safeAuthDestination(destination), destination);
  const login = auth.loginPathForDestination(destination);
  assert.equal(
    new URL(login, "http://localhost").searchParams.get("next"),
    destination,
  );
  assert.equal(
    auth.authDestination(login.slice(login.indexOf("?"))),
    destination,
  );
  for (const value of [
    `https://evil.test${destination}`,
    `//evil.test${destination}`,
    "/merchant/kitchens/bad",
    `${destination}/edit`,
    `${destination}?next=https://evil.test`,
    `${destination}#other`,
    "/merchant/kitchens/%2e%2e",
  ])
    assert.equal(auth.safeAuthDestination(value), null);
});

test("private detail query binds the merchant's store and exact design without loading the whole list", async () => {
  const calls = [];
  let store = {
    id: "owned-store",
    name: "Factory",
    store_type: "factory",
    active: true,
  };
  const db = {
    from(table) {
      const chain = {
        select: () => chain,
        order: () => chain,
        eq: (...args) => {
          calls.push([table, "eq", ...args]);
          return chain;
        },
        limit: (value) => {
          calls.push([table, "limit", value]);
          return chain;
        },
        maybeSingle: async () => ({ data: store, error: null }),
        then: (resolve, reject) =>
          Promise.resolve({ data: [], error: null }).then(resolve, reject),
      };
      return chain;
    },
    rpc: async () => ({
      data: { enabled: true, limit: 3, used: 0 },
      error: null,
    }),
  };
  const { readMerchantKitchenDesignById } = loadSource(
    "src/lib/kitchenMarketplaceServer.ts",
    { "./supabase/admin": { getSupabaseAdmin: () => db } },
  );
  assert.equal(
    (await readMerchantKitchenDesignById("verified-merchant", designId, db))
      .design,
    null,
  );
  assert.deepEqual(calls, [
    ["merchant_stores", "eq", "owner_id", "verified-merchant"],
    ["kitchen_designs", "eq", "store_id", "owned-store"],
    ["kitchen_designs", "eq", "id", designId],
    ["kitchen_designs", "limit", 1],
  ]);
  store = null;
  calls.length = 0;
  assert.equal(
    (await readMerchantKitchenDesignById("other-merchant", designId, db))
      .eligible,
    false,
  );
  assert.deepEqual(calls, [
    ["merchant_stores", "eq", "owner_id", "other-merchant"],
  ]);
});

test("merchant detail GET uses verified ownership and handles missing/ineligible designs privately", async () => {
  const calls = [];
  let auth = { userId: "verified-merchant" };
  let result = { eligible: true, design: { id: designId }, renderUsage: null };
  const { GET } = loadSource(
    "src/app/api/merchant/kitchen-designs/[id]/route.ts",
    {
      "@/lib/supabase/requireMerchant": { requireMerchant: async () => auth },
      "@/lib/kitchenMarketplaceServer": {
        readMerchantKitchenDesignById: async (...args) => {
          calls.push(args);
          return result;
        },
      },
    },
  );
  const request = new NextRequest(
    "http://localhost/api/merchant/kitchen-designs/" + designId,
  );
  const params = (id = designId) => ({ params: Promise.resolve({ id }) });
  const response = await GET(request, params());
  assert.equal(response.status, 200);
  assert.deepEqual(calls, [["verified-merchant", designId]]);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  result = { eligible: true, design: null };
  assert.equal((await GET(request, params())).status, 404);
  result = { eligible: false, design: null };
  assert.equal((await GET(request, params())).status, 403);
  assert.equal((await GET(request, params("invalid"))).status, 400);
  const count = calls.length;
  auth = {
    error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  };
  assert.equal((await GET(request, params())).status, 401);
  assert.equal(calls.length, count);
});

test("gallery removal authenticates before calling the atomic owner/version/media RPC", async () => {
  const calls = [];
  let auth = { userId: "verified-merchant" };
  let error = null;
  const { DELETE } = loadSource(
    "src/app/api/merchant/kitchen-designs/[id]/media/[mediaId]/route.ts",
    {
      "@/lib/supabase/requireMerchant": { requireMerchant: async () => auth },
      "@/lib/supabase/admin": {
        getSupabaseAdmin: () => ({
          rpc: async (name, args) => {
            calls.push({ name, args });
            return { data: { id: mediaId, replacementMediaId: null }, error };
          },
        }),
      },
    },
  );
  const params = { params: Promise.resolve({ id: designId, mediaId }) };
  const request = (version = versionId) =>
    new NextRequest(
      `http://localhost/api/merchant/kitchen-designs/${designId}/media/${mediaId}?versionId=${version}&actor=forged`,
      { method: "DELETE" },
    );
  const response = await DELETE(request(), params);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.deepEqual(calls[0], {
    name: "remove_kitchen_design_media",
    args: {
      p_actor: "verified-merchant",
      p_design: designId,
      p_version: versionId,
      p_media: mediaId,
    },
  });
  assert.equal((await DELETE(request("bad"), params)).status, 400);
  assert.equal(calls.length, 1);
  for (const [code, status] of [
    ["42501", 403],
    ["P0002", 404],
    ["P0020", 409],
  ]) {
    error = { code };
    const failed = await DELETE(request(), params);
    assert.equal(failed.status, status);
    assert.match(failed.headers.get("cache-control"), /no-store/);
  }
  const count = calls.length;
  auth = { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  assert.equal((await DELETE(request(), params)).status, 403);
  assert.equal(calls.length, count);
});

test("merchant gallery selects uploaded images, exposes removal for single images, and protects pending media", () => {
  const { KitchenDesignGallery } = loadSource(
    "src/components/KitchenDesignGallery.tsx",
    {
      "next/image": {
        default: ({ src, alt, className }) =>
          React.createElement("img", { src, alt, className }),
      },
    },
  );
  const original = {
    id: "original",
    kind: "thumbnail",
    source: "merchant",
    url: "https://example.com/original.png",
    isPrimary: true,
    createdAt: "2026-10-10",
  };
  const ai = {
    ...original,
    id: "ai",
    kind: "ai_render",
    source: "ai",
    isPrimary: false,
    createdAt: "2026-10-11",
  };
  const uploaded = {
    ...original,
    id: "upload",
    url: "blob:preview",
    createdAt: "2026-10-12",
  };
  const render = (props) =>
    renderToStaticMarkup(
      React.createElement(KitchenDesignGallery, {
        media: [original],
        title: "Kitchen",
        ...props,
      }),
    );
  assert.doesNotMatch(render({}), /kd-thumbnail-delete/);
  assert.match(render({ onRemove() {} }), /kd-thumbnail-delete/);
  const pending = render({
    media: [original, ai, uploaded],
    activeMediaId: "upload",
    pendingMediaId: "upload",
    onRemove() {},
    removeDisabled: (item) => item.id === "original",
  });
  assert.match(pending, /src="blob:preview"[^>]*class="kd-gallery-image"/);
  assert.match(pending, /Оруулж байна/);
  assert.match(pending, /aria-busy="true"/);
  assert.equal((pending.match(/class="kd-thumbnail-delete"/g) || []).length, 2);
  assert.match(pending, /Одоо устгах боломжгүй/);
});
