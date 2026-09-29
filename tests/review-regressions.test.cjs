const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadSource } = require("./helpers/load-source.cjs");

const options = loadSource("src/lib/modelOptions.ts");
const color = { id: "oak", name: "Oak", hex: "#C9A37A" };
const material = { id: "wood", name: "Wood", priceDelta: 0 };

test("valid model options preserve numeric prices and default optional color price", () => {
  assert.deepEqual(options.parseModelColors(JSON.stringify([color])), [{ ...color, priceDelta: 0 }]);
  assert.deepEqual(options.parseModelMaterials(JSON.stringify([material])), [material]);
});

test("malformed and incomplete options are rejected before they reach the planner", () => {
  for (const invalid of [null, "{", "{}", "[]", "[null]", "[1]", '[{"id":"oak"}]']) {
    assert.throws(() => options.parseModelColors(invalid), options.ModelOptionsError);
  }
  for (const invalid of [
    [{ ...color, hex: "broken" }],
    [{ ...color, priceDelta: "100" }],
    [color, color],
  ]) {
    assert.throws(() => options.parseModelColors(JSON.stringify(invalid)), options.ModelOptionsError);
  }
  for (const invalid of [
    [{ ...material, id: "unsupported" }],
    [{ ...material, priceDelta: null }],
    [{ ...material, priceDelta: "100" }],
  ]) {
    assert.throws(() => options.parseModelMaterials(JSON.stringify(invalid)), options.ModelOptionsError);
  }
});

test("invalid upload options return HTTP 400 without uploading files", async () => {
  const route = loadSource("src/app/api/models/upload/route.ts", {
    "@/lib/modelOptions": options,
    "@/lib/supabase/requireAdmin": { requireAdmin: async () => ({ userId: "admin", error: null }) },
    "@/lib/supabase/admin": {
      getSupabaseAdmin: () => ({
        storage: { from: () => { assert.fail("Invalid input must not reach storage"); } },
      }),
    },
  });
  const form = new FormData();
  form.set("name", "Test model");
  form.set("stockQuantity", "2");
  form.set("glb", new File(["fixture"], "model.glb"));
  form.set("colors", '[{"id":"incomplete"}]');
  form.set("materials", JSON.stringify([material]));
  const response = await route.POST(new Request("http://localhost/api/models/upload", {
    method: "POST", body: form,
  }));
  assert.equal(response.status, 400);
  assert.equal(typeof (await response.json()).error, "string");
});

test("model list is dynamic and subsequent requests read current database values", async () => {
  let rows = [];
  const route = loadSource("src/app/api/models/route.ts", {
    "@/lib/catalogServer": { readProducts: async () => [] },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => ({
      from: () => ({ select: () => ({ order: async () => ({ data: rows, error: null }) }) }),
    }) },
  });
  assert.equal(route.dynamic, "force-dynamic");
  const initial = await route.GET();
  assert.equal(initial.headers.get("cache-control"), "no-store");
  assert.deepEqual(await initial.json(), []);
  rows = [{ id: "new-model", name: "New model", glb_path: "new-model/model.glb" }];
  assert.equal((await (await route.GET()).json())[0].id, "new-model");
  rows = [];
  assert.deepEqual(await (await route.GET()).json(), []);
});

test("deleting the active saved design cannot resurrect it with saveCurrent", () => {
  const memory = new Map();
  global.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  global.window = { localStorage: global.localStorage };
  try {
    const { useDesigns } = loadSource("src/store/designs.ts");
    useDesigns.getState().createNew("80", "First");
    useDesigns.getState().saveCurrent();
    const firstId = useDesigns.getState().current.id;
    useDesigns.getState().createNew("40", "Second");
    useDesigns.getState().saveCurrent();
    const secondId = useDesigns.getState().current.id;
    useDesigns.getState().deleteDesign(firstId);
    assert.equal(useDesigns.getState().current.id, secondId);
    useDesigns.getState().deleteDesign(secondId);
    assert.equal(useDesigns.getState().current, null);
    useDesigns.getState().saveCurrent();
    assert.deepEqual(useDesigns.getState().designs, []);
    assert.equal(JSON.parse(memory.get("casa-designs-guest")).state.current, null);
  } finally {
    delete global.localStorage;
    delete global.window;
  }
});
