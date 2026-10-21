const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const frameId = "11111111-1111-4111-8111-111111111111";
const lightId = "22222222-2222-4222-8222-222222222222";
const moduleId = "33333333-3333-4333-8333-333333333333";

function model(id, specifications = {}) {
  return {
    id,
    product_id: id,
    name: "Kitchen model",
    category: "kitchen-cabinet",
    description: "",
    base_price: 0,
    image_url: "/image.png",
    glb_path: "model.glb",
    thumbnail_path: null,
    preview_glb_path: null,
    processing_status: "ready",
    archived_at: null,
    scale: 1,
    dimensions_w: 0.6,
    dimensions_d: 0.6,
    dimensions_h: 0.8,
    colors: [{ id: "white", name: "White", hex: "#ffffff", priceDelta: 0 }],
    materials: [{ id: "metal", name: "Metal", priceDelta: 0 }],
    default_color: "white",
    in_stock: 0,
    specifications,
  };
}
const lightAsset = {
  kitchenAsset: JSON.stringify({
    version: 1,
    type: "light-pendant",
    installation: "freestanding",
  }),
};

function database(overrides = {}, failure = null) {
  const queries = [];
  const rows = {
    kitchen_modules: [
      {
        id: moduleId,
        code: "BASE-600",
        name: "Base",
        cabinet_type: "base",
        width_mm: 600,
        height_mm: 840,
        depth_mm: 600,
        active: true,
      },
    ],
    kitchen_module_variants: [
      {
        furniture_model_id: frameId,
        module_id: moduleId,
        variant_code: "BASE-600-WHITE",
        opening: "doors",
        door_count: 1,
        drawer_count: 0,
        configuration: {},
        is_default: true,
        sort_order: 0,
        active: true,
      },
    ],
    kitchen_models: [model(frameId), model(lightId, lightAsset)],
    material_definitions: [],
    ...overrides,
  };
  const db = {
    from(table) {
      const query = { table, fields: "", conditions: [], limit: 1000 };
      queries.push(query);
      return {
        select(fields) {
          query.fields = fields;
          return this;
        },
        order() {
          return this;
        },
        eq(key, value) {
          query.conditions.push((row) => row[key] === value);
          return this;
        },
        is(key, value) {
          query.conditions.push((row) => row[key] === value);
          return this;
        },
        in(key, values) {
          query.conditions.push((row) => values.includes(row[key]));
          return this;
        },
        gt(key, value) {
          query.conditions.push((row) => row[key] > value);
          return this;
        },
        limit(value) {
          query.limit = value;
          return this;
        },
        then(resolve, reject) {
          let error = failure?.(query);
          if (query.fields.split(",").includes("made_to_order"))
            error = {
              code: "42703",
              message: "column kitchen_models.made_to_order does not exist",
            };
          const data = error
            ? null
            : rows[table]
                .filter((row) => query.conditions.every((match) => match(row)))
                .slice(0, query.limit)
                .map((row) =>
                  Object.fromEntries(
                    query.fields.split(",").map((field) => [field, row[field]]),
                  ),
                );
          return Promise.resolve({ data, error: error ?? null }).then(
            resolve,
            reject,
          );
        },
      };
    },
  };
  return { db, queries };
}

test("public kitchen catalog succeeds against its separate schema without furniture-only columns", async () => {
  const { db, queries } = database();
  const { GET } = loadSource("src/app/api/kitchen-modules/route.ts", {
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
  });
  const response = await GET();
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.modules.length, 1);
  assert.equal(data.modules[0].variants.length, 1);
  assert.equal(data.modules[0].variants[0].glbFile, "model.glb");
  assert.equal(data.assets.length, 1);
  assert.equal(data.assets[0].id, lightId);
  assert.equal(data.assets[0].madeToOrder, false);
  assert.equal(
    data.assets[0].inStock,
    false,
    "missing made_to_order must not grant availability to zero-stock items",
  );
  for (const query of queries.filter(
    (query) => query.table === "kitchen_models",
  )) {
    assert.ok(!query.fields.includes("made_to_order"));
    assert.ok(!query.fields.includes("*"));
  }
});

test("asset reads keep readiness/category/archive filters and skip malformed asset metadata", async () => {
  const valid = model(lightId, lightAsset);
  valid.in_stock = 4;
  const { db } = database({
    kitchen_models: [
      valid,
      { ...model(frameId, lightAsset), processing_status: "processing" },
      { ...model(frameId, lightAsset), archived_at: "2026-10-22" },
      { ...model(frameId, lightAsset), category: "sofa" },
      { ...model(frameId, lightAsset), glb_path: null },
      model(frameId, { kitchenAsset: "broken" }),
    ],
  });
  const { readKitchenAssets } = loadSource(
    "src/lib/kitchenModuleCatalogServer.ts",
    { "@/lib/supabase/admin": { getSupabaseAdmin: () => db } },
  );
  const assets = await readKitchenAssets(db);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].id, lightId);
  assert.equal(assets[0].inStock, true);
  assert.equal(assets[0].stockQuantity, 4);
  assert.equal(assets[0].model.file, "model.glb");
});

test("backend errors still fail closed instead of reporting an empty available catalog", async () => {
  const { db } = database({}, (query) =>
    query.table === "kitchen_models"
      ? { code: "42703", message: "private schema diagnostic" }
      : null,
  );
  const { GET } = loadSource("src/app/api/kitchen-modules/route.ts", {
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
  });
  const response = await GET();
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, "SERVICE_UNAVAILABLE");
  assert.ok(!JSON.stringify(body).includes("private schema diagnostic"));
  assert.equal(body.modules, undefined);
});
