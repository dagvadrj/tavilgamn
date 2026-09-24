const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NextRequest, NextResponse } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");
const { createUnifiedKitchen } = loadSource("src/lib/kitchenAssembly.ts");
const id = "12345678-1234-1234-1234-123456789abc";
const row = (name = "Гарнитур") => ({
  id,
  name,
  design: createUnifiedKitchen(),
  thumbnail_url: null,
  created_at: "2026-09-13T00:00:00Z",
  updated_at: "2026-09-13T00:00:00Z",
});
function api(owner, error = null) {
  const calls = [];
  let value = row();
  const db = {
    from(table) {
      assert.equal(table, "kitchen_garnitures");
      const chain = {
        select() {
          return chain;
        },
        eq(...args) {
          calls.push(["eq", ...args]);
          return chain;
        },
        order() {
          return chain;
        },
        limit: async () => ({ data: [value], error }),
        upsert(data, options) {
          calls.push(["upsert", data, options]);
          value = { ...value, ...data };
          return chain;
        },
        single: async () => ({ data: value, error }),
        delete() {
          calls.push(["delete"]);
          return chain;
        },
        then(resolve) {
          return Promise.resolve({ error }).then(resolve);
        },
      };
      return chain;
    },
  };
  return {
    calls,
    route: loadSource("src/app/api/kitchens/route.ts", {
      "@/lib/supabase/requireUser": {
        requireUser: async () =>
          owner
            ? { userId: owner }
            : { error: NextResponse.json({}, { status: 401 }) },
      },
      "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
    }),
  };
}
const put = (body) =>
  new NextRequest("http://localhost/api/kitchens", {
    method: "PUT",
    body: JSON.stringify(body),
  });
test("kitchen API authenticates reads, writes and deletion before accessing database", async () => {
  const { route, calls } = api(null);
  assert.equal(
    (await route.GET(new NextRequest("http://localhost/api/kitchens"))).status,
    401,
  );
  assert.equal((await route.PUT(put({}))).status, 401);
  assert.equal(
    (
      await route.DELETE(
        new NextRequest(`http://localhost/api/kitchens?id=${id}`, {
          method: "DELETE",
        }),
      )
    ).status,
    401,
  );
  assert.deepEqual(calls, []);
});
test("save roundtrip preserves poses and materials and ignores caller-supplied ownership", async () => {
  const { route, calls } = api("verified-owner"),
    design = createUnifiedKitchen();
  design.cabinets[0].color = "#aabbcc";
  design.cabinets[0].handleStyle = "knob";
  const response = await route.PUT(
    put({ id, name: " Гал тогоо ", design, user_id: "victim" }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await response.json()).kitchen.design, design);
  assert.equal(calls[0][1].user_id, "verified-owner");
  assert.equal(calls[0][1].name, "Гал тогоо");
  assert.deepEqual(calls[0][2], { onConflict: "user_id,id" });
  await route.GET(
    new NextRequest("http://localhost/api/kitchens?user_id=victim"),
  );
  assert.deepEqual(calls.at(-1), ["eq", "user_id", "verified-owner"]);
  await route.DELETE(
    new NextRequest(`http://localhost/api/kitchens?id=${id}`, {
      method: "DELETE",
    }),
  );
  assert.deepEqual(calls.slice(-2), [
    ["eq", "user_id", "verified-owner"],
    ["eq", "id", id],
  ]);
});
test("invalid kitchen and oversized body never write; database failure never reports success", async () => {
  const { route, calls } = api("owner");
  for (const body of [
    null,
    {},
    { id, name: "", design: createUnifiedKitchen() },
    { id, name: "x", design: { version: 2 } },
  ])
    assert.equal((await route.PUT(put(body))).status, 400);
  assert.equal(
    (await route.PUT(put({ value: "x".repeat(250000) }))).status,
    413,
  );
  assert.deepEqual(calls, []);
  const failed = await api("owner", { message: "private SQL error" }).route.PUT(
    put({ id, name: "x", design: createUnifiedKitchen() }),
  );
  assert.equal(failed.status, 503);
  assert.doesNotMatch(await failed.text(), /private SQL/);
});
test("thumbnail upload checks ownership before Cloudinary and stores only its validated URL", async () => {
  let uploaded = false,
    updated = null;
  const db = {
    from(table) {
      assert.equal(table, "kitchen_garnitures");
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        maybeSingle: async () => ({ data: { id }, error: null }),
        update(payload) {
          updated = payload;
          return chain;
        },
        then(resolve) {
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return chain;
    },
  };
  const route = loadSource("src/app/api/kitchens/[id]/thumbnail/route.ts", {
    "@/lib/supabase/requireUser": {
      requireUser: async () => ({ userId: "owner", error: null }),
    },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
    "@/lib/cloudinaryImageUpload": {
      uploadCloudinaryImage: async (file, publicId, options) => {
        uploaded = true;
        assert.equal(file.type, "image/webp");
        assert.equal(publicId, `casa-nova/kitchen-projects/${id}`);
        assert.deepEqual(options, { overwrite: true });
        return {
          url: "https://res.cloudinary.com/demo/image/upload/project.webp",
          width: 900,
          height: 600,
        };
      },
    },
  });
  const form = new FormData();
  form.set(
    "file",
    new File(["x".repeat(200)], "kitchen.webp", { type: "image/webp" }),
  );
  const response = await route.POST(
    new NextRequest(`http://localhost/api/kitchens/${id}/thumbnail`, {
      method: "POST",
      body: form,
    }),
    { params: { id } },
  );
  assert.equal(response.status, 200);
  assert.equal(uploaded, true);
  assert.deepEqual(updated, {
    thumbnail_url: "https://res.cloudinary.com/demo/image/upload/project.webp",
  });
  assert.equal((await response.json()).thumbnailUrl, updated.thumbnail_url);
});
test("published marketplace clone authenticates, validates and calls the atomic owner-bound RPC", async () => {
  const designId = "12345678-1234-4234-8234-123456789abc";
  const projectId = "22345678-1234-4234-8234-123456789abc";
  const calls = [];
  const kitchen = row("Marketplace хуулбар");
  const db = {
    rpc: async (name, payload) => {
      calls.push([name, payload]);
      return { data: kitchen, error: null };
    },
  };
  const route = loadSource("src/app/api/kitchen-designs/[id]/clone/route.ts", {
    "@/lib/supabase/requireUser": {
      requireUser: async () => ({ userId: "verified-owner", error: null }),
    },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
  });
  const request = (body) =>
    new NextRequest(`http://localhost/api/kitchen-designs/${designId}/clone`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  const response = await route.POST(request({ projectId, user_id: "victim" }), {
    params: { id: designId },
  });
  assert.equal(response.status, 201);
  assert.deepEqual(calls[0], [
    "clone_published_kitchen_design",
    {
      p_actor: "verified-owner",
      p_design: designId,
      p_project: projectId,
    },
  ]);
  assert.equal((await response.json()).kitchen.name, "Marketplace хуулбар");
  assert.equal(
    (
      await route.POST(request({ projectId: "../bad" }), {
        params: { id: designId },
      })
    ).status,
    400,
  );
  assert.equal(calls.length, 1);
});
test("kitchen quote API validates contact and uses only the verified customer identity", async () => {
  const designId = "12345678-1234-4234-8234-123456789abc";
  const key = "22345678-1234-4234-8234-123456789abc";
  const calls = [];
  const db = {
    rpc: async (name, payload) => {
      calls.push([name, payload]);
      return { data: { id: key, status: "submitted" }, error: null };
    },
  };
  const route = loadSource("src/app/api/kitchen-designs/[id]/quotes/route.ts", {
    "@/lib/supabase/requireUser": {
      requireUser: async () => ({ userId: "verified-customer", error: null }),
    },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
  });
  const request = (body) =>
    new NextRequest(`http://localhost/api/kitchen-designs/${designId}/quotes`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    });
  const body = {
    idempotencyKey: key,
    name: " Test user ",
    phone: "99112233",
    email: "USER@example.com",
    roomWidthMm: 4000,
    roomDepthMm: 3000,
    roomHeightMm: 2700,
    message: "Oak front",
    user_id: "victim",
  };
  const response = await route.POST(request(body), {
    params: { id: designId },
  });
  assert.equal(response.status, 201);
  assert.deepEqual(calls[0], [
    "create_kitchen_quote_request",
    {
      p_actor: "verified-customer",
      p_design: designId,
      p_project: null,
      p_idempotency: key,
      p_contact: {
        name: "Test user",
        phone: "99112233",
        email: "user@example.com",
      },
      p_room: { widthMm: 4000, depthMm: 3000, heightMm: 2700 },
      p_message: "Oak front",
    },
  ]);
  assert.equal(
    (
      await route.POST(request({ ...body, email: "bad" }), {
        params: { id: designId },
      })
    ).status,
    400,
  );
  assert.equal(calls.length, 1);
});

test("merchant quote API reads and updates through owner-bound RPCs", async () => {
  const quoteId = "32345678-1234-4234-8234-123456789abc";
  const calls = [];
  const db = {
    rpc: async (name, payload) => {
      calls.push([name, payload]);
      return {
        data: name.startsWith("read_") ? [{ id: quoteId }] : null,
        error: null,
      };
    },
  };
  const route = loadSource("src/app/api/merchant/kitchen-quotes/route.ts", {
    "@/lib/supabase/requireMerchant": {
      requireMerchant: async () => ({
        userId: "verified-merchant",
        error: null,
      }),
    },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
  });
  const read = await route.GET(
    new NextRequest("http://localhost/api/merchant/kitchen-quotes?page=0"),
  );
  assert.equal(read.status, 200);
  assert.equal((await read.json()).quotes[0].id, quoteId);
  const update = await route.PATCH(
    new NextRequest("http://localhost/api/merchant/kitchen-quotes", {
      method: "PATCH",
      body: JSON.stringify({
        id: quoteId,
        status: "quoted",
        expectedStatus: "reviewing",
        quotedPrice: 4200000,
        note: "Includes installation",
      }),
    }),
  );
  assert.equal(update.status, 200);
  assert.deepEqual(calls[1], [
    "update_merchant_kitchen_quote",
    {
      p_actor: "verified-merchant",
      p_quote: quoteId,
      p_status: "quoted",
      p_expected_status: "reviewing",
      p_price: 4200000,
      p_note: "Includes installation",
    },
  ]);
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
function store() {
  let sessionOwner = "a";
  const state = loadSource("src/store/kitchens.ts", {
    "@/lib/supabase/client": {
      supabase: {
        auth: {
          getSession: async () => ({
            data: {
              session: { user: { id: sessionOwner }, access_token: "fixture" },
            },
          }),
        },
      },
    },
  });
  state.setKitchenOwner("a");
  return {
    ...state,
    changeOwner: (owner) => {
      sessionOwner = owner;
      state.setKitchenOwner(owner);
    },
  };
}
test("account switch discards previous owner pending list and save responses", async (t) => {
  const previous = global.fetch;
  t.after(() => {
    global.fetch = previous;
  });
  const s = store(),
    read = deferred(),
    write = deferred();
  global.fetch = async (_, init) => ({
    ok: true,
    json: () => (init.method === "PUT" ? write.promise : read.promise),
  });
  const refresh = s.useKitchens.getState().refresh(),
    save = s.useKitchens.getState().save(id, "x", createUnifiedKitchen());
  await new Promise((resolve) => setImmediate(resolve));
  s.changeOwner("b");
  read.resolve({ kitchens: [row()] });
  write.resolve({ kitchen: row() });
  await refresh;
  assert.equal(await save, null);
  assert.deepEqual(s.useKitchens.getState().items, []);
  assert.equal(s.useKitchens.getState().owner, "b");
});
test("late refresh cannot replace a saved version or resurrect a deleted kitchen", async (t) => {
  const previous = global.fetch;
  t.after(() => {
    global.fetch = previous;
  });
  const s = store(),
    pending = deferred();
  global.fetch = async (_, init) => ({
    ok: true,
    json: async () =>
      init.method === "PUT"
        ? { kitchen: row("New") }
        : init.method === "DELETE"
          ? { ok: true }
          : pending.promise,
  });
  const refresh = s.useKitchens.getState().refresh();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(
    await s.useKitchens.getState().save(id, "New", createUnifiedKitchen()),
  );
  pending.resolve({ kitchens: [row("Old")] });
  await refresh;
  assert.equal(s.useKitchens.getState().items[0].name, "New");
  const pendingDelete = deferred();
  global.fetch = async (_, init) => ({
    ok: true,
    json: async () =>
      init.method === "DELETE" ? { ok: true } : pendingDelete.promise,
  });
  const refresh2 = s.useKitchens.getState().refresh();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(await s.useKitchens.getState().remove(id), true);
  pendingDelete.resolve({ kitchens: [row("Old")] });
  await refresh2;
  assert.deepEqual(s.useKitchens.getState().items, []);
});
