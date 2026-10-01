const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { NextRequest } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");

test("shop and planner shells are structurally separate and public URLs stay unchanged", () => {
  const read = file => fs.readFileSync(file, "utf8");
  assert.doesNotMatch(read("src/app/layout.tsx"), /<Header|<Footer/);
  assert.match(read("src/app/layout.tsx"), /<AuthBootstrap/);
  assert.match(read("src/app/(shop)/layout.tsx"), /<Header/);
  assert.match(read("src/app/(shop)/layout.tsx"), /<Footer/);
  assert.match(read("src/app/(shop)/layout.tsx"), /shop-shell/);
  assert.doesNotMatch(read("src/components/room-planner.css"), /height: calc\(100dvh - (166|220)px/);
  assert.doesNotMatch(read("src/app/(planner)/layout.tsx"), /Header|Footer/);
  for (const route of ["planner", "kitchen"]) assert.ok(fs.existsSync("src/app/(planner)/" + route + "/page.tsx"));
  for (const file of ["Header", "Footer"]) assert.doesNotMatch(read("src/components/" + file + ".tsx"), /return null;/);
});

test("auth initialization is shared across layouts and retries after an outage", async () => {
  let reads = 0, listeners = 0, fail = true;
  const supabase = { auth: {
    getSession: async () => { reads++; if (fail) throw new Error("offline"); return { data: { session: null } }; },
    onAuthStateChange: () => { listeners++; },
  } };
  const noop = () => {};
  const { useAuth } = loadSource("src/store/auth.ts", {
    "@/lib/supabase/client": { isSupabaseConfigured: true, supabase },
    "@/store/cart": { setCartOwner: noop },
    "@/store/wishlist": { setWishlistOwner: noop },
    "@/store/designs": { setDesignOwner: noop },
    "@/store/kitchens": { setKitchenOwner: noop },
  });
  const first = useAuth.getState().initialize();
  assert.equal(first, useAuth.getState().initialize());
  await assert.rejects(first, /offline/);
  assert.equal(useAuth.getState().initialized, false);
  fail = false;
  await Promise.all([useAuth.getState().initialize(), useAuth.getState().initialize()]);
  await useAuth.getState().initialize();
  assert.equal(reads, 2);
  assert.equal(listeners, 1);
  assert.equal(useAuth.getState().initialized, true);
});

test("every explicit API error uses the shared response contract without changing successful envelopes", () => {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (file.endsWith(".ts")) files.push(file);
    }
  }
  walk("src/app/api");
  for (const file of files) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(source) === "NextResponse.json") {
        const [body, init] = node.arguments;
        const error = body && ts.isObjectLiteralExpression(body) && body.properties.some(p => p.name?.getText(source) === "error");
        const status = init && ts.isObjectLiteralExpression(init) && init.properties.find(p => p.name?.getText(source) === "status");
        if (error && status && Number(status.initializer?.getText(source)) >= 400) assert.fail(file + " bypasses API error contract");
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const { apiErrorResponse } = loadSource("src/lib/api/errors.ts");
  const response = apiErrorResponse({ error: "Алдаа" }, { status: 409, headers: { "Retry-After": "5", "Cache-Control": "public" } });
  assert.equal(response.status, 409);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("retry-after"), "5");
});

test("admin, merchant and user auth share verified identity, fresh permissions and outage handling", async () => {
  let role = "customer", identityError = null, roleError = null, throws = false, reads = 0;
  const db = {
    auth: { getUser: async () => {
      reads++;
      if (throws) throw new Error("private backend detail");
      return { data: { user: identityError ? null : { id: "verified-user", user_metadata: { role: "admin" } } }, error: identityError };
    } },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role }, error: roleError }) }) }) }),
  };
  const { authorize } = loadSource("src/lib/supabase/authorize.ts", { "./admin": { getSupabaseAdmin: () => db } });
  const request = token => new NextRequest("http://local/api", token ? { headers: { authorization: token } } : {});
  const missing = await authorize(request(), "admin");
  assert.equal(missing.error.status, 401);
  assert.equal(reads, 0);
  const forbidden = await authorize(request("bearer   token"), "admin");
  assert.deepEqual(await forbidden.error.json(), { error: "Admin эрх шаардлагатай.", code: "FORBIDDEN" });
  role = "admin";
  assert.equal((await authorize(request("Bearer token"), "admin")).userId, "verified-user");
  assert.equal((await authorize(request("Bearer token"), "merchant")).error.status, 403);
  roleError = { code: "outage" };
  assert.equal((await authorize(request("Bearer token"), "admin")).error.status, 503);
  assert.equal((await authorize(request("Bearer token"))).userId, "verified-user");
  throws = true;
  const outage = await authorize(request("Bearer token"));
  assert.equal(outage.error.status, 503);
  assert.ok(!(await outage.error.text()).includes("private backend detail"));
});

test("category labels and types derive from one manifest; database JSON boundaries validate shape", () => {
  const { CATEGORIES, CATEGORY_LABEL, isCategory } = loadSource("src/lib/catalogCategories.ts");
  for (const category of CATEGORIES) {
    assert.equal(CATEGORY_LABEL[category.id], category.name);
    assert.equal(isCategory(category.id), true);
  }
  assert.equal(isCategory("unknown"), false);
  const { toJson, jsonObject, jsonArray } = loadSource("src/lib/supabase/json.ts");
  assert.deepEqual(toJson({ value: 1, omitted: undefined }), { value: 1 });
  assert.deepEqual(jsonArray(null), []);
  assert.throws(() => jsonArray({}), /array/);
  assert.throws(() => jsonObject([]), /object/);
  assert.throws(() => toJson(undefined), /JSON/);
});
