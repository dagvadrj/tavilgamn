const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const React = require("react");
const THREE = require("three");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");
const model = loadSource("src/lib/kitchenAssembly.ts");
const { createCabinet } = loadSource("src/lib/kitchenCabinets.ts");
const placement = loadSource("src/lib/kitchenPlacement.ts");
const { kitchenRoomPiece } = loadSource("src/lib/kitchenRoomPiece.ts");
const mocks = {
  "@/store/catalog": { getProduct: () => undefined },
  "@/lib/modelRegistry": { getDbModel: () => undefined },
};
const collision = loadSource("src/three/collision.ts", mocks);
const saved = (design) => ({
  id: "12345678-1234-1234-1234-123456789abc",
  name: "Миний гал тогоо",
  design,
});
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.00001, `${a} != ${b}`);

test("kitchen marketplace exposes complete listing details without a duplicate data model", () => {
  const server = fs.readFileSync("src/lib/kitchenMarketplaceServer.ts", "utf8");
  const merchant = fs.readFileSync(
    "src/components/MerchantKitchenDesigns.tsx",
    "utf8",
  );
  const admin = fs.readFileSync(
    "src/components/AdminKitchenDesigns.tsx",
    "utf8",
  );
  const listing = fs.readFileSync("src/app/kitchens/page.tsx", "utf8");
  const detail = fs.readFileSync("src/app/kitchens/[slug]/page.tsx", "utf8");
  assert.match(server, /service_areas,inclusions,exclusions/);
  assert.match(server, /readPublishedKitchenDesignBySlug/);
  assert.match(server, /\.eq\("publication_status", "published"\)/);
  assert.match(merchant, /serviceAreas: splitList\(serviceAreas\)/);
  assert.match(merchant, /installationIncluded/);
  assert.match(admin, /Marketplace дэлгэрэнгүй/);
  assert.match(listing, /href=\{`\/kitchens\/\$\{design\.slug\}`\}/);
  assert.match(detail, /AI бодит дүрслэл/);
  assert.match(detail, /Үнэд багтсан/);
  assert.match(detail, /Үйлдвэртэй холбогдох/);
});

test("AI kitchen renders persist a guarded job before generation and permanent media after it", () => {
  const marketplace = loadSource("src/lib/kitchenMarketplace.ts");
  const request = marketplace.readKitchenRenderRequest({
    versionId: "12345678-1234-4234-8234-123456789abc",
    sourceMediaId: "22345678-1234-4234-8234-123456789abc",
    direction: "Warm evening light with oak flooring",
  });
  assert.match(request.prompt, /Preserve the exact cabinet count/);
  assert.match(request.prompt, /Warm evening light/);
  assert.throws(
    () =>
      marketplace.readKitchenRenderRequest({
        versionId: "../bad",
        sourceMediaId: "bad",
      }),
    marketplace.KitchenMarketplaceInputError,
  );

  const merchantRoute = fs.readFileSync(
    "src/app/api/merchant/kitchen-designs/[id]/renders/route.ts",
    "utf8",
  );
  const adminRoute = fs.readFileSync(
    "src/app/api/admin/kitchen-render-jobs/[id]/generate/route.ts",
    "utf8",
  );
  const migration = fs.readFileSync(
    "supabase/migrations/20260923094000_kitchen_ai_render_workflow.sql",
    "utf8",
  );
  assert.match(merchantRoute, /requireMerchant\(request\)/);
  assert.match(merchantRoute, /request_kitchen_render/);
  assert.match(adminRoute, /requireAdmin\(request\)/);
  assert.match(adminRoute, /claim_kitchen_render/);
  assert.match(adminRoute, /https:\/\/api\.openai\.com\/v1\/images\/edits/);
  assert.match(adminRoute, /uploadCloudinaryImage/);
  assert.match(adminRoute, /complete_kitchen_render/);
  assert.match(migration, /kitchen_render_jobs_one_active_idx/);
  assert.match(migration, /kind,source,url.*'ai_render','ai'/s);
  assert.match(migration, /from public,anon,authenticated/);
});

test("planner captures its clean 3D canvas and persists it as the project thumbnail", () => {
  const planner = fs.readFileSync(
    "src/components/ModularKitchenPlanner.tsx",
    "utf8",
  );
  const scene = fs.readFileSync("src/three/ModularKitchenScene.tsx", "utf8");
  const route = fs.readFileSync(
    "src/app/api/kitchens/[id]/thumbnail/route.ts",
    "utf8",
  );
  const migration = fs.readFileSync(
    "supabase/migrations/20260923110000_kitchen_project_thumbnails.sql",
    "utf8",
  );
  assert.match(scene, /preserveDrawingBuffer: true/);
  assert.match(scene, /toBlob\(resolve, "image\/webp"/);
  assert.match(scene, /object\.userData\.exportExclude/);
  assert.match(planner, /library\.saveThumbnail\(saved\.id, image\)/);
  assert.match(route, /requireUser\(request\)/);
  assert.match(route, /kitchen-projects\/\$\{params\.id\}/);
  assert.match(route, /thumbnail_url: image\.url/);
  assert.match(migration, /copy_kitchen_project_thumbnail_to_marketplace/);
  assert.match(migration, /'thumbnail','system'/);
});

test("merchant edits only an open draft and creates a guarded version after publication", () => {
  const marketplace = loadSource("src/lib/kitchenMarketplace.ts");
  const parsed = marketplace.parseKitchenMarketplaceVersion({
    versionId: "12345678-1234-4234-8234-123456789abc",
    mode: "new_version",
    title: "Шинэ хувилбар",
    shortDescription: "",
    description: "",
    style: "modern",
    pricingMode: "from",
    priceFrom: "4200000",
    leadTimeDays: "20",
    warrantyMonths: "24",
    installationIncluded: true,
    tags: ["oak"],
    serviceAreas: ["Улаанбаатар"],
    inclusions: ["Шүүгээ"],
    exclusions: [],
  });
  assert.equal(parsed.mode, "new_version");
  assert.equal(parsed.payload.priceFrom, 4200000);
  assert.throws(
    () =>
      marketplace.parseKitchenMarketplaceVersion({
        ...parsed.payload,
        versionId: "bad",
        mode: "edit",
      }),
    marketplace.KitchenMarketplaceInputError,
  );
  assert.throws(
    () =>
      marketplace.parseKitchenMarketplaceVersion({
        ...parsed.payload,
        versionId: "12345678-1234-4234-8234-123456789abc",
        mode: "replace",
      }),
    marketplace.KitchenMarketplaceInputError,
  );
  const route = fs.readFileSync(
    "src/app/api/merchant/kitchen-designs/[id]/route.ts",
    "utf8",
  );
  const component = fs.readFileSync(
    "src/components/MerchantKitchenDesigns.tsx",
    "utf8",
  );
  const migration = fs.readFileSync(
    "supabase/migrations/20260923123000_kitchen_marketplace_version_editing.sql",
    "utf8",
  );
  assert.match(route, /export async function PUT/);
  assert.match(route, /save_kitchen_marketplace_version/);
  assert.match(component, /Мэдээлэл засах/);
  assert.match(component, /Шинэ version/);
  assert.match(component, /publishedVersionId !== design\.versionId/);
  assert.match(component, /Шинэчлэлийг нийтлэх/);
  assert.match(
    migration,
    /current_version\.review_status not in \('draft','changes_requested'\)/,
  );
  assert.match(
    migration,
    /target_design\.published_version_id=current_version\.id/,
  );
  assert.match(migration, /for update of d/);
});

test("admin AI render route saves generated bytes before completing the database job", async () => {
  const calls = [];
  const db = {
    rpc: async (name, payload) => {
      calls.push([name, payload]);
      if (name === "claim_kitchen_render")
        return {
          data: {
            id: "32345678-1234-4234-8234-123456789abc",
            versionId: "42345678-1234-4234-8234-123456789abc",
            inputImageUrl:
              "https://res.cloudinary.com/demo/image/upload/source.webp",
            prompt: "Keep the exact kitchen geometry.",
            provider: "openai",
            model: "gpt-image-2.5-sunburst",
          },
          error: null,
        };
      if (name === "complete_kitchen_render")
        return { data: "52345678-1234-4234-8234-123456789abc", error: null };
      return { data: null, error: null };
    },
  };
  let uploaded;
  const route = loadSource(
    "src/app/api/admin/kitchen-render-jobs/[id]/generate/route.ts",
    {
      "next/server": {
        NextResponse: {
          json: (body, init = {}) => ({
            body,
            status: init.status ?? 200,
            headers: init.headers,
          }),
        },
      },
      "@/lib/cloudinaryImageUpload": {
        cloudinaryImageUploadConfigured: () => true,
        uploadCloudinaryImage: async (file) => {
          uploaded = file;
          return {
            url: "https://res.cloudinary.com/demo/image/upload/result.webp",
            publicId: "result",
            format: "webp",
            bytes: file.size,
            width: 1536,
            height: 1024,
          };
        },
      },
      "@/lib/kitchenMarketplaceHttp": {
        kitchenPrivateHeaders: {},
        kitchenMarketplaceError: (error) => ({
          status: 503,
          body: { error: error.message },
        }),
      },
      "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
      "@/lib/supabase/requireAdmin": {
        requireAdmin: async () => ({ userId: "admin", error: null }),
      },
    },
  );
  const originalFetch = global.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  global.fetch = async (url) => {
    if (String(url).startsWith("https://res.cloudinary.com/"))
      return new Response(new Blob(["source"], { type: "image/webp" }), {
        status: 200,
        headers: { "content-type": "image/webp" },
      });
    assert.equal(url, "https://api.openai.com/v1/images/edits");
    return new Response(
      JSON.stringify({
        data: [{ b64_json: Buffer.from("generated-image").toString("base64") }],
        usage: { output_tokens: 10 },
      }),
      {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-request-id": "req_test",
        },
      },
    );
  };
  try {
    const response = await route.POST(
      {},
      { params: { id: "32345678-1234-4234-8234-123456789abc" } },
    );
    assert.equal(response.status, 200);
    assert.equal(uploaded.type, "image/webp");
    assert.deepEqual(
      calls.map(([name]) => name),
      ["claim_kitchen_render", "complete_kitchen_render"],
    );
    assert.equal(calls[1][1].p_metadata.providerRequestId, "req_test");
    assert.equal(calls[1][1].p_metadata.usage.output_tokens, 10);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  }
});

test("kitchen admin upload pins the correct category and protects its R2 handoff", () => {
  const component = fs.readFileSync(
    "src/components/AdminKitchenModules.tsx",
    "utf8",
  );
  const createRoute = fs.readFileSync(
    "src/app/api/models/upload/route.ts",
    "utf8",
  );
  const prepareRoute = fs.readFileSync(
    "src/app/api/admin/models/upload-url/route.ts",
    "utf8",
  );
  const completeRoute = fs.readFileSync(
    "src/app/api/admin/models/upload-complete/route.ts",
    "utf8",
  );
  assert.match(component, /form\.set\("category", "kitchen-cabinet"\)/);
  assert.match(component, /Гал тогооны GLB нэмэх/);
  assert.match(createRoute, /"kitchen-cabinet"/);
  assert.match(prepareRoute, /body\?\.modelId/);
  assert.match(prepareRoute, /if \(auth\.error\)/);
  assert.match(completeRoute, /if \(auth\.error\)/);
});

test("Supabase materials are normalized and classify cabinet GLB surfaces", () => {
  const {
    normalizeKitchenMaterials,
    isKitchenMaterialTarget,
    kitchenCabinetSurface,
  } = loadSource("src/lib/kitchenMaterials.ts");
  const materials = normalizeKitchenMaterials([
    {
      id: "oak",
      name: " Царс ",
      surface_kind: "general",
      base_color: "#bb915e",
      roughness: "0.650",
      metalness: "0",
      texture_paths: {},
    },
    {
      id: "bad color",
      name: "Bad",
      surface_kind: "general",
      base_color: "red",
      roughness: 1,
      metalness: 0,
      texture_paths: {},
    },
  ]);
  assert.deepEqual(materials, [
    {
      id: "oak",
      name: "Царс",
      surfaceKind: "general",
      baseColor: "#BB915E",
      roughness: 0.65,
      metalness: 0,
      texturePaths: {},
    },
  ]);
  assert.equal(isKitchenMaterialTarget("CABINET_FRONT", "Oak"), true);
  assert.equal(kitchenCabinetSurface("CABINET_FRONT", "Oak"), "front");
  assert.equal(kitchenCabinetSurface("Cabinet_Box", "Oak"), "carcass");
  assert.equal(isKitchenMaterialTarget("Appliance-Oven", "Steel"), false);
  assert.equal(isKitchenMaterialTarget("Door", "Glass"), false);

  const route = fs.readFileSync("src/app/api/kitchen-modules/route.ts", "utf8");
  const planner = fs.readFileSync(
    "src/components/ModularKitchenPlanner.tsx",
    "utf8",
  );
  const scene = fs.readFileSync("src/three/ModularKitchenScene.tsx", "utf8");
  assert.match(route, /normalizeKitchenMaterials\(materials\.data\)/);
  assert.match(planner, /materialDefinitions=\{materialDefinitions\}/);
  assert.match(scene, /frontMaterial=\{frontMaterial\}/);
  assert.match(scene, /carcassMaterial=\{carcassMaterial\}/);
});

test("admin kitchen materials validate input and use the existing protected table", () => {
  const {
    KitchenMaterialInputError,
    normalizeAdminKitchenMaterials,
    parseKitchenMaterialInput,
    parseKitchenMaterialState,
  } = loadSource("src/lib/kitchenMaterials.ts");
  assert.deepEqual(
    parseKitchenMaterialInput({
      id: " Dark_Oak ",
      name: " Хар царс ",
      surfaceKind: "front",
      baseColor: "#6a4b32",
      roughness: "0.72",
      metalness: 0,
      texturePaths: {
        baseColor: "https://cdn.example.com/oak.webp",
        normal: "",
        injected: "https://bad.example.com/ignored",
      },
    }),
    {
      id: "dark_oak",
      name: "Хар царс",
      surfaceKind: "front",
      baseColor: "#6A4B32",
      roughness: 0.72,
      metalness: 0,
      texturePaths: { baseColor: "https://cdn.example.com/oak.webp" },
    },
  );
  assert.throws(
    () =>
      parseKitchenMaterialInput({
        id: "../oak",
        name: "Oak",
        surfaceKind: "general",
        baseColor: "#000000",
        roughness: 1,
        metalness: 0,
      }),
    KitchenMaterialInputError,
  );
  assert.throws(
    () =>
      parseKitchenMaterialInput({
        id: "oak",
        name: "Oak",
        surfaceKind: "general",
        baseColor: "#000000",
        roughness: 1.1,
        metalness: 0,
      }),
    KitchenMaterialInputError,
  );
  assert.throws(
    () =>
      parseKitchenMaterialInput({
        id: "oak",
        name: "Oak",
        surfaceKind: "general",
        baseColor: "#000000",
        roughness: 1,
        metalness: 0,
        texturePaths: { normal: "javascript:alert(1)" },
      }),
    KitchenMaterialInputError,
  );
  assert.deepEqual(parseKitchenMaterialState({ id: "OAK", active: false }), {
    id: "oak",
    active: false,
  });
  assert.equal(
    normalizeAdminKitchenMaterials([
      {
        id: "oak",
        name: "Oak",
        surface_kind: "general",
        base_color: "#aa8844",
        roughness: 0.6,
        metalness: 0,
        texture_paths: {},
        active: false,
        created_at: "2026-01-01",
        updated_at: "2026-01-02",
      },
    ])[0].active,
    false,
  );

  const route = fs.readFileSync(
    "src/app/api/admin/kitchen-materials/route.ts",
    "utf8",
  );
  const component = fs.readFileSync(
    "src/components/AdminKitchenMaterials.tsx",
    "utf8",
  );
  const page = fs.readFileSync(
    "src/components/AdminKitchenDesigns.tsx",
    "utf8",
  );
  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /from\("material_definitions"\)/);
  assert.doesNotMatch(route, /\.delete\(/);
  assert.match(component, /method: editingId \? "PUT" : "POST"/);
  assert.match(component, /method: "PATCH"/);
  assert.match(page, /<AdminKitchenMaterials owner=\{owner\} \/>/);
});

test("admin texture upload is protected and GLB materials receive cached texture maps", async () => {
  class MockTextureLoader {
    setCrossOrigin(value) {
      this.crossOrigin = value;
      return this;
    }
    async loadAsync(url) {
      const texture = new THREE.Texture();
      texture.userData.url = url;
      return texture;
    }
  }
  const { acquireKitchenMaterialTextures } = loadSource(
    "src/three/kitchenMaterialTextures.ts",
    {
      three: { ...THREE, TextureLoader: MockTextureLoader },
    },
  );
  const lease = acquireKitchenMaterialTextures({
    baseColor: "https://res.cloudinary.com/demo/image/upload/oak.webp",
    normal: "https://res.cloudinary.com/demo/image/upload/oak-normal.webp",
  });
  const textures = await lease.promise;
  assert.equal(textures.baseColor.colorSpace, THREE.SRGBColorSpace);
  assert.equal(textures.normal.colorSpace, THREE.NoColorSpace);
  assert.equal(textures.baseColor.flipY, false);
  assert.equal(textures.baseColor.wrapS, THREE.RepeatWrapping);
  lease.release();

  const route = fs.readFileSync(
    "src/app/api/admin/kitchen-material-textures/route.ts",
    "utf8",
  );
  const component = fs.readFileSync(
    "src/components/AdminKitchenMaterials.tsx",
    "utf8",
  );
  const glb = fs.readFileSync("src/three/GLBFurnitureMesh.tsx", "utf8");
  const scene = fs.readFileSync("src/three/ModularKitchenScene.tsx", "utf8");
  assert.match(route, /requireAdmin\(request\)/);
  assert.match(route, /from\("material_definitions"\)/);
  assert.match(route, /casa-nova\/kitchen-materials/);
  assert.match(component, /\/api\/admin\/kitchen-material-textures/);
  assert.match(glb, /acquireKitchenMaterialTextures/);
  assert.match(glb, /material\.normalMap = textures\.normal/);
  assert.match(scene, /frontMaterial=\{frontMaterial\}/);
  assert.match(scene, /carcassMaterial=\{carcassMaterial\}/);
});

test("texture upload merges the new Cloudinary URL into the existing material paths", async () => {
  let updated;
  const row = {
    id: "oak",
    name: "Царс",
    surface_kind: "general",
    base_color: "#BB915E",
    roughness: 0.65,
    metalness: 0,
    texture_paths: {},
    active: true,
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
  };
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: "oak",
              texture_paths: {
                normal: "https://res.cloudinary.com/demo/old.png",
              },
            },
            error: null,
          }),
        }),
      }),
      update: (payload) => {
        updated = payload;
        return {
          eq: () => ({
            select: () => ({
              single: async () => ({
                data: { ...row, texture_paths: payload.texture_paths },
                error: null,
              }),
            }),
          }),
        };
      },
    }),
  };
  const route = loadSource(
    "src/app/api/admin/kitchen-material-textures/route.ts",
    {
      "next/server": {
        NextResponse: {
          json: (body, init = {}) => ({
            body,
            status: init.status ?? 200,
            headers: init.headers,
          }),
        },
      },
      "@/lib/supabase/requireAdmin": {
        requireAdmin: async () => ({ userId: "admin", error: null }),
      },
      "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
    },
  );
  const form = new FormData();
  form.set("materialId", "oak");
  form.set("kind", "baseColor");
  form.set("file", new File(["png"], "oak.png", { type: "image/png" }));
  const originalFetch = global.fetch;
  const originalCloudinary = [
    process.env.CLOUDINARY_CLOUD_NAME,
    process.env.CLOUDINARY_API_KEY,
    process.env.CLOUDINARY_API_SECRET,
  ];
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
  process.env.CLOUDINARY_API_KEY = "key";
  process.env.CLOUDINARY_API_SECRET = "secret";
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      secure_url: "https://res.cloudinary.com/demo/image/upload/oak.png",
      public_id: "casa-nova/kitchen-materials/oak/baseColor",
    }),
  });
  try {
    const response = await route.POST({ formData: async () => form });
    assert.equal(response.status, 201);
    assert.deepEqual(updated.texture_paths, {
      normal: "https://res.cloudinary.com/demo/old.png",
      baseColor: "https://res.cloudinary.com/demo/image/upload/oak.png",
    });
    assert.equal(
      response.body.material.texturePaths.baseColor,
      "https://res.cloudinary.com/demo/image/upload/oak.png",
    );
  } finally {
    global.fetch = originalFetch;
    [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ].forEach((name, index) => {
      const value = originalCloudinary[index];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  }
});

test("unified design preserves appearance and IDs across four layouts and JSON roundtrip", () => {
  const base = model.createUnifiedKitchen();
  const schema = new (require("ajv"))().compile(
    JSON.parse(
      require("node:fs").readFileSync("src/lib/cabinet.schema.json", "utf8"),
    ),
  );
  for (const c of base.cabinets)
    assert.equal(schema(c), true, JSON.stringify(schema.errors));
  const styled = model.applyKitchenAppearance(base, null, {
    finish: "walnut",
    frontMaterialId: "merchant_front_01",
    carcassMaterialId: "merchant_carcass_01",
    handleStyle: "knob",
    color: "#123456",
    frontStyle: "shaker",
  });
  styled.countertop.materialId = "merchant_countertop_01";
  const selected = model.applyKitchenAppearance(styled, ["base-1"], {
    color: "#ffffff",
  });
  assert.equal(
    selected.cabinets.find((c) => c.id === "base-2").color,
    "#123456",
  );
  for (const layout of ["straight", "l-left", "l-right", "double-side"]) {
    const next = model.arrangeKitchen(selected, layout);
    assert.deepEqual(
      placement.placementIssues(next).filter((i) => i.severity === "error"),
      [],
    );
    assert.deepEqual(
      model.parseKitchen(JSON.parse(JSON.stringify(next))),
      next,
    );
    assert.deepEqual(
      next.cabinets.map((c) => [
        c.id,
        c.finish,
        c.frontMaterialId,
        c.carcassMaterialId,
        c.handleStyle,
      ]),
      selected.cabinets.map((c) => [
        c.id,
        c.finish,
        c.frontMaterialId,
        c.carcassMaterialId,
        c.handleStyle,
      ]),
    );
    assert.equal(next.countertop.materialId, "merchant_countertop_01");
    for (const c of next.cabinets)
      assert.equal(
        c.width,
        c.corner
          ? c.type === "base"
            ? 1000
            : 800
          : selected.cabinets.find((before) => before.id === c.id).width,
      );
  }
  assert.equal(base.cabinets[0].finish, "oak");
});

test("JSON rejects invalid sizes, overlaps, duplicate IDs and unsupported appliance openings", () => {
  const k = model.createUnifiedKitchen();
  for (const mutate of [
    (k) => (k.cabinets[0].width = 550),
    (k) => (k.cabinets[1].id = k.cabinets[0].id),
    (k) => (k.cabinets[2].position.x = k.cabinets[0].position.x),
    (k) => (k.cabinets[1].opening = "sink"),
    (k) => (k.cabinets[0].position.rotation = NaN),
    (k) => (k.countertop.finish = "invalid"),
    (k) => (k.cabinets[0].frontMaterialId = "../bad"),
    (k) => (k.countertop.materialId = "Bad ID"),
    (k) => (k.cabinets = []),
  ]) {
    const next = model.cloneKitchen(k);
    mutate(next);
    assert.throws(() => model.parseKitchen(next));
  }
  const next = model.parseKitchen({
    ...k,
    secret: "ignored",
    room: { ...k.room, injected: 1 },
  });
  assert.equal(next.secret, undefined);
  assert.equal(next.room.injected, undefined);
});

test("kitchen GLB variant identity survives JSON while malformed IDs are rejected", () => {
  const kitchen = model.createUnifiedKitchen();
  kitchen.cabinets[0].variantId = "12345678-1234-4234-9234-123456789abc";
  const parsed = model.parseKitchen(JSON.parse(JSON.stringify(kitchen)));
  assert.equal(parsed.cabinets[0].variantId, kitchen.cabinets[0].variantId);
  const invalid = model.cloneKitchen(kitchen);
  invalid.cabinets[0].variantId = "../private.glb";
  assert.throws(() => model.parseKitchen(invalid));
});

test("catalog default replaces procedural cabinet while preserving explicit matching choice", () => {
  const { applyKitchenCatalogVariants } = loadSource(
    "src/lib/kitchenModuleCatalog.ts",
  );
  const kitchen = model.createUnifiedKitchen();
  const first = "12345678-1234-4234-9234-123456789abc";
  const second = "12345678-1234-4234-9234-123456789abd";
  const modules = [
    {
      id: "m",
      code: "BASE-600",
      name: "Base 600",
      cabinetType: "base",
      widthMm: 600,
      heightMm: 820,
      depthMm: 600,
      active: true,
      variants: [
        {
          furnitureModelId: first,
          opening: "drawers",
          active: true,
          isDefault: true,
          glbFile: "high.glb",
        },
        {
          furnitureModelId: second,
          opening: "drawers",
          active: true,
          isDefault: false,
          glbFile: "high.glb",
        },
      ],
    },
  ];
  const automatic = applyKitchenCatalogVariants(kitchen, modules);
  assert.equal(
    automatic.cabinets.find((c) => c.opening === "drawers").variantId,
    first,
  );
  const explicit = model.cloneKitchen(kitchen);
  explicit.cabinets.find((c) => c.opening === "drawers").variantId = second;
  assert.equal(
    applyKitchenCatalogVariants(explicit, modules).cabinets.find(
      (c) => c.opening === "drawers",
    ).variantId,
    second,
  );
});

// Build actual Three geometries from the shared renderer without a browser or WebGL.
// Texture generation and React effects are irrelevant to physical bounds.
const { KitchenAssemblyMesh } = loadSource(
  "src/three/KitchenAssemblyMesh.tsx",
  {
    react: { ...React, useMemo: (fn) => fn(), useEffect: () => {} },
    "./kitchenTextures": { createKitchenTexture: () => null },
  },
);
function scene(node, parent = new THREE.Group()) {
  for (const element of React.Children.toArray(node)) {
    if (!React.isValidElement(element)) continue;
    if (typeof element.type === "function") {
      scene(element.type(element.props), parent);
      continue;
    }
    if (typeof element.type === "symbol") {
      scene(element.props.children, parent);
      continue;
    }
    const geometry = {
      boxGeometry: THREE.BoxGeometry,
      sphereGeometry: THREE.SphereGeometry,
      ringGeometry: THREE.RingGeometry,
      extrudeGeometry: THREE.ExtrudeGeometry,
    }[element.type];
    if (geometry) {
      parent.geometry = new geometry(...element.props.args);
      continue;
    }
    if (!["mesh", "group"].includes(element.type)) continue;
    const object =
      element.type === "mesh" ? new THREE.Mesh() : new THREE.Group();
    if (element.props.position)
      object.position.fromArray(element.props.position);
    if (element.props.rotation)
      object.rotation.fromArray(element.props.rotation);
    parent.add(object);
    scene(element.props.children, object);
  }
  return parent;
}
test("shared 3D mesh matches declared millimetres including handles, taps and rotated L runs", () => {
  for (const layout of ["straight", "l-left", "l-right"])
    for (const handleStyle of ["bar", "knob", "push-open"]) {
      const k = model.arrangeKitchen(
        model.applyKitchenAppearance(model.createUnifiedKitchen(), null, {
          handleStyle,
        }),
        layout,
      );
      const rendered = scene(
        React.createElement(KitchenAssemblyMesh, {
          kitchen: k,
          centered: true,
        }),
      );
      const box = new THREE.Box3().setFromObject(rendered),
        size = box.getSize(new THREE.Vector3()),
        declared = model.kitchenEnvelope(k);
      near(size.x, declared.w);
      near(size.y, declared.h);
      near(size.z, declared.d);
      near(box.getCenter(new THREE.Vector3()).x, 0);
      near(box.getCenter(new THREE.Vector3()).z, 0);
      rendered.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
  const k = model.createUnifiedKitchen();
  k.backsplash = false;
  k.cabinets = k.cabinets.filter((c) => c.opening === "sink");
  near(model.kitchenEnvelope(k).h, 1.11);
  const rendered = scene(
    React.createElement(KitchenAssemblyMesh, { kitchen: k }),
  );
  near(new THREE.Box3().setFromObject(rendered).max.y, 1.11);
});

test("room snapshot survives saved-design mutation and room cloning without scaling", () => {
  const k = model.createUnifiedKitchen(),
    piece = kitchenRoomPiece(saved(k), "placed");
  const expected = model.kitchenEnvelope(k);
  k.cabinets[0].width = 300;
  assert.equal(piece.kitchen.design.cabinets[0].width, 600);
  assert.deepEqual(collision.dimsFor(piece), {
    w: expected.w,
    d: expected.d,
    h: expected.h,
  });
  const { cloneRoom } = loadSource("src/lib/roomDesign.ts");
  const room = { id: "room", width: 5, depth: 5, height: 2.7, pieces: [piece] };
  const copy = cloneRoom(room);
  copy.pieces[0].kitchen.design.cabinets[0].width = 400;
  assert.equal(piece.kitchen.design.cabinets[0].width, 600);
  assert.deepEqual(
    JSON.parse(JSON.stringify(room)).pieces[0].kitchen,
    piece.kitchen,
  );
});

test("exact fitting room accepts kitchen, undersized room and low ceiling reject it", () => {
  const piece = kitchenRoomPiece(saved(model.createUnifiedKitchen()), "p");
  const { w, d, h } = collision.dimsFor(piece),
    room = { width: w, depth: 2, height: h };
  const positioned = collision.findFreePlacement({ ...piece, x: 20 }, [], room);
  assert.ok(positioned);
  near(positioned.x, 0);
  assert.deepEqual(positioned.kitchen, piece.kitchen);
  assert.equal(
    collision.findFreePlacement(piece, [], { ...room, width: w - 0.001 }),
    null,
  );
  assert.equal(
    collision.findFreePlacement(piece, [], { ...room, height: h - 0.001 }),
    null,
  );
  assert.equal(
    collision.isPlacementValid({ ...piece, rotation: Math.PI / 2 }, [], {
      width: 2,
      depth: w,
      height: h,
    }),
    true,
  );
  assert.ok(d > 0.6);
});

test("L empty corner remains usable while columns and furniture intersecting its cabinets reject placement", () => {
  const k = model.arrangeKitchen(model.createUnifiedKitchen(), "l-left");
  const piece = kitchenRoomPiece(saved(k), "k");
  const env = model.kitchenEnvelope(k),
    room = { width: 6, depth: 6, height: 2.7 };
  const toWorld = (x, z) => ({
    x: (x - env.centerX) / 1000,
    z: (z - env.centerZ) / 1000,
  });
  const empty = {
    instanceId: "box",
    productId: "box",
    rotation: 0,
    ...toWorld(1300, 1300),
  };
  assert.equal(collision.isPlacementValid(piece, [empty], room), true);
  const hit = { ...empty, ...toWorld(300, 900) };
  assert.equal(collision.isPlacementValid(piece, [hit], room), false);
  const column = {
    id: "c",
    x: hit.x + 3,
    z: hit.z + 3,
    width: 0.1,
    depth: 0.1,
  };
  assert.equal(
    collision.isPlacementValid(piece, [], { ...room, columns: [column] }),
    false,
  );
});

test("plan markup contains measured wall segments, current furniture and immediate column removal", () => {
  const { RoomPlanPreview } = loadSource(
    "src/components/RoomPlanPreview.tsx",
    mocks,
  );
  const room = {
    width: 5,
    depth: 4,
    height: 2.7,
    wallFeatures: [
      {
        id: "notch",
        wall: "north",
        kind: "inset",
        offset: 0,
        length: 0.6,
        depth: 0.2,
      },
    ],
    columns: [{ id: "c", x: 2, z: 2, width: 0.3, depth: 0.3 }],
  };
  const piece = kitchenRoomPiece(saved(model.createUnifiedKitchen()), "p");
  const render = (room) =>
    renderToStaticMarkup(
      React.createElement(RoomPlanPreview, { room, pieces: [piece] }),
    );
  const html = render(room);
  assert.match(html, /5000 мм/);
  assert.match(html, /4000 мм/);
  assert.match(html, /Х6/);
  assert.match(html, /room-plan-column/);
  assert.match(html, /room-plan-furniture/);
  assert.doesNotMatch(render({ ...room, columns: [] }), /room-plan-column/);
});
