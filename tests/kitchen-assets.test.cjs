const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { NextRequest, NextResponse } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");
const catalog = loadSource("src/lib/kitchenAssetCatalog.ts");
const extras = loadSource("src/lib/kitchenExtras.ts");
const assembly = loadSource("src/lib/kitchenAssembly.ts");
const { cabinetFromCatalog } = loadSource("src/lib/kitchenCatalogInsertion.ts");
const { cabinetVariantCode } = loadSource("src/lib/cabinetCodes.ts");
const { validateCabinet } = loadSource("src/lib/kitchenCabinets.ts");
const { catalogEligible } = loadSource("src/lib/roomCatalogPolicy.ts");
const uuid = "11111111-1111-4111-8111-111111111111";
function asset(type, installation = "freestanding") {
  return catalog.parseKitchenAsset({ version: 1, type, installation });
}
function extra(type) {
  return {
    id: "extra-1",
    productId: "product-1",
    name: "Kitchen item",
    category: "kitchen-cabinet",
    width: 100,
    height: 80,
    depth: 100,
    position: { x: 1000, y: 0, z: 1500, rotation: 0 },
    color: "#eeeeee",
    material: "metal",
    asset: asset(type),
  };
}

test("kitchen classification covers each appliance, water, dining and lighting type and ignores forged placement", () => {
  for (const type of Object.keys(catalog.KITCHEN_ASSET_TYPES)) {
    const parsed = asset(type);
    assert.equal(parsed.type, type);
    assert.ok(
      ["appliances", "water", "extras", "dining"].includes(
        catalog.assetGroup(parsed),
      ),
    );
    assert.deepEqual(
      catalog.kitchenAsset({ kitchenAsset: JSON.stringify(parsed) }),
      parsed,
    );
  }
  assert.equal(
    catalog.parseKitchenAsset({
      version: 1,
      type: "fridge",
      installation: "integrated",
      placement: "floor",
    }).placement,
    "cabinet",
  );
  for (const value of [
    null,
    {},
    { version: 1, type: "__proto__", installation: "freestanding" },
    { version: 1, type: "hood", installation: "unsafe" },
  ])
    assert.throws(() => catalog.parseKitchenAsset(value));
  assert.equal(catalog.kitchenAsset({ kitchenAsset: "broken" }), null);
  const { productFromRow } = loadSource("src/lib/catalogServer.ts");
  const product = productFromRow({
    id: uuid,
    product_id: uuid,
    name: "Pendant",
    category: "kitchen-cabinet",
    description: "",
    base_price: 0,
    image_url: "/image.png",
    thumbnail_path: null,
    glb_path: "model.glb",
    processing_status: "ready",
    scale: 1,
    dimensions_w: 0.1,
    dimensions_h: 0.2,
    dimensions_d: 0.1,
    colors: [{ id: "white", name: "White", hex: "#ffffff", priceDelta: 0 }],
    materials: [{ id: "metal", name: "Metal", priceDelta: 0 }],
    default_color: "white",
    in_stock: 0,
    store_ids: [],
    specifications: {
      type: "kitchen-part:lighting",
      assembly: "connector-origin",
      kitchenAsset: JSON.stringify(asset("light-pendant")),
    },
  });
  assert.equal(
    catalog.kitchenAsset(product.specifications).type,
    "light-pendant",
  );
  assert.equal(product.model.file, "model.glb");
  assert.equal(
    catalogEligible({ category: "kitchen-cabinet" }, "kitchen", "all"),
    false,
  );
  assert.equal(catalogEligible({ category: "chair" }, "kitchen", "room"), true);
});

test("elevated extras roundtrip at their real height, respect ceilings and cannot insert integrated equipment independently", () => {
  const kitchen = assembly.createUnifiedKitchen();
  kitchen.extras = [
    {
      ...extra("light-under"),
      position: { x: 3300, y: 1800, z: 2200, rotation: 0 },
    },
  ];
  const saved = assembly.parseKitchen(kitchen);
  assert.equal(saved.extras[0].position.y, 1800);
  assert.deepEqual(saved.extras[0].asset, kitchen.extras[0].asset);
  assert.ok(assembly.kitchenEnvelope(saved).h >= 1.88);
  assert.throws(() =>
    extras.parseKitchenExtras(
      [
        {
          ...extra("light-under"),
          position: { x: 100, y: 2550, z: 100, rotation: 0 },
        },
      ],
      new Set(),
      kitchen.room,
    ),
  );
  assert.throws(() =>
    extras.parseKitchenExtras(
      [{ ...extra("fridge"), asset: asset("fridge", "integrated") }],
      new Set(),
      kitchen.room,
    ),
  );
  const pendant = extras.findExtraSpace(kitchen, extra("light-pendant"));
  assert.equal(pendant.position.y, kitchen.room.height - pendant.height);
  assert.equal(
    extras.findExtraSpace(kitchen, {
      ...extra("fridge"),
      asset: asset("fridge", "integrated"),
    }),
    null,
  );
  const support = assembly.createUnifiedKitchen();
  support.cabinets = [{ ...support.cabinets[0], height: 740 }];
  const tap = extras.findExtraSpace(support, extra("tap"));
  assert.equal(tap.position.y, 740 + support.countertop.thickness);
  assert.equal(tap.position.x, support.cabinets[0].position.x);
  const wallLight = extras.findExtraSpace(support, extra("light-under"));
  assert.equal(wallLight.position.z, wallLight.depth / 2);
});

test("all new module families produce valid cabinet geometry and canonical variant codes", () => {
  const specs = [
    ["BASE-150", "base", 150, 840, 600],
    ["BASE-200", "base", 200, 840, 600],
    ["CORNER-WALL-600", "wall", 600, 720, 350],
    ["CORNER-WALL-680", "wall", 680, 720, 350],
    ["FRIDGE-WALL-600-H400-D600", "wall", 600, 400, 600],
    ["ISLAND-1200-H840-D900", "base", 1200, 840, 900],
  ];
  for (const [code, cabinetType, widthMm, heightMm, depthMm] of specs) {
    const variant = {
      furnitureModelId: uuid,
      opening: "doors",
      doorCount: 1,
      drawerCount: 0,
      active: true,
      glbFile: "model.glb",
    };
    const module = {
      code,
      cabinetType,
      widthMm,
      heightMm,
      depthMm,
      active: true,
      variants: [variant],
    };
    const cabinet = cabinetFromCatalog(module, variant, "cabinet", 2800);
    assert.equal(validateCabinet(cabinet), null, code);
    assert.equal(cabinet.corner, code.startsWith("CORNER-"));
    assert.match(cabinetVariantCode(code, "doors", 1, 0), /-1-DOOR$/);
    const kitchen = assembly.createUnifiedKitchen();
    kitchen.room.height = 2800;
    kitchen.cabinets = [cabinet];
    assert.equal(assembly.parseKitchen(kitchen).cabinets[0].depth, depthMm);
  }
});

test("seed adds eight families idempotently and preserves existing module dimensions", async () => {
  const { PGlite } = require("@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec(
      `create table kitchen_modules(code text unique,name text,cabinet_type text,width_mm int,height_mm int,depth_mm int);insert into kitchen_modules values('BASE-150','Existing','base',150,850,610);`,
    );
    const sql = fs.readFileSync(
      "supabase/migrations/20261019111038_kitchen_catalog_extended_modules.sql",
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    assert.equal(
      (await db.query("select count(*)::int n from kitchen_modules")).rows[0].n,
      8,
    );
    assert.equal(
      (
        await db.query(
          "select height_mm from kitchen_modules where code='BASE-150'",
        )
      ).rows[0].height_mm,
      850,
    );
  } finally {
    await db.close();
  }
});

test("admin upload shows only fields for the selected kitchen group", () => {
  const drafts = new Map();
  const mocks = {
    react: {
      ...React,
      useState: (v) => [typeof v === "function" ? v() : v, () => {}],
      useEffect: () => {},
      useCallback: (f) => f,
      useMemo: (f) => f(),
      useRef: (v) => ({ current: v }),
    },
    "next/dynamic": { default: () => () => null },
    "@/hooks/useDashboardDraft": {
      useDraftState: (_scope, key, initial) => [
        drafts.has(key) ? drafts.get(key) : initial,
        (v) => drafts.set(key, v),
      ],
      useDraftStatus: () => ({ loading: false }),
      clearDashboardDraft: () => {},
    },
    "@/components/DashboardDraftNotice": { DashboardDraftNotice: () => null },
  };
  const { AdminKitchenModules } = loadSource(
    "src/components/AdminKitchenModules.tsx",
    mocks,
  );
  function visible(node) {
    if (!React.isValidElement(node)) return node;
    if (node.props.hidden) return null;
    return React.cloneElement(
      node,
      {},
      ...React.Children.toArray(node.props.children).map(visible),
    );
  }
  const initial = renderToStaticMarkup(
    visible(AdminKitchenModules({ owner: "admin" })),
  );
  assert.match(initial, /Шүүгээний төрөл/);
  assert.doesNotMatch(initial, /Суурилуулах хэлбэр/);
  drafts.set("group", "appliances");
  drafts.set("assetType", "fridge");
  drafts.set("uploadPartKind", "appliance");
  const appliance = renderToStaticMarkup(
    visible(AdminKitchenModules({ owner: "admin" })),
  );
  assert.match(appliance, /Хөргөгч/);
  assert.match(appliance, /Суурилуулах хэлбэр/);
  assert.doesNotMatch(appliance, /Шүүгээний төрөл/);
});

test("merchant product GLB download requires current ownership and signs only server-selected files", async () => {
  let authenticated = false,
    storeActive = true,
    owned = true,
    ready = true,
    standard = false;
  const filters = [],
    signed = [];
  const db = {
    from(table) {
      const chain = {
        select: () => chain,
        eq: (...args) => {
          filters.push([table, ...args]);
          return chain;
        },
        is: () => chain,
        maybeSingle: async () => ({
          error: null,
          data:
            table === "merchant_stores"
              ? storeActive
                ? { id: "own-store" }
                : null
              : {
                  id: uuid,
                  store_ids: [owned ? "own-store" : "other-store"],
                  processing_status: ready ? "ready" : "idle",
                  glb_path: `r2://bucket/models/${uuid}/model.glb`,
                  export_status: standard ? "ready" : "idle",
                  standard_glb_path: standard ? `r2://bucket/models/${uuid}/standard/file.glb` : null,
                },
        }),
      };
      return chain;
    },
  };
  const { GET } = loadSource(
    "src/app/api/merchant/products/[id]/glb/route.ts",
    {
      "@/lib/supabase/requireMerchant": {
        requireMerchant: async () =>
          authenticated
            ? { userId: "real-owner" }
            : { error: NextResponse.json({}, { status: 401 }) },
      },
      "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
      "@/lib/r2Models": {
        r2ModelKey: (path) => path.startsWith("r2://"),
        r2DownloadUrl: async (path) => {
          signed.push(path);
          return "https://signed.example/file";
        },
      },
    },
  );
  const req = new NextRequest(
      "http://localhost/api/merchant/products/product-1/glb?owner=forged&path=secret",
    ),
    params = { params: Promise.resolve({ id: "product-1" }) };
  assert.equal((await GET(req, params)).status, 401);
  assert.equal(filters.length, 0);
  authenticated = true;
  owned = false;
  assert.equal((await GET(req, params)).status, 404);
  assert.equal(signed.length, 0);
  owned = true;
  ready = false;
  assert.equal((await GET(req, params)).status, 200);
  assert.equal(signed.length, 0);
  ready = true;
  assert.equal((await (await GET(req, params)).json()).ready, false);
  assert.equal(signed.length, 0, "compressed delivery is never a Blender fallback");
  standard = true;
  const response = await GET(req, params);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(signed.length, 1);
  assert.match(signed[0], /\/standard\//);
  assert.ok(
    filters.some(
      (x) =>
        x[0] === "merchant_stores" &&
        x[1] === "owner_id" &&
        x[2] === "real-owner",
    ),
  );
  storeActive = false;
  assert.equal((await GET(req, params)).status, 403);
});
