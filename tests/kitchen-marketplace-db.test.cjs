const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");

test("kitchen marketplace enforces publisher, review, thumbnail and public visibility", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key references auth.users(id), role text not null);
    create table public.furniture_models(
      id uuid primary key default gen_random_uuid(),
      category text not null,
      product_id text,
      name text not null default '',
      glb_path text,
      thumbnail_path text,
      dimensions_w numeric not null default 1,
      dimensions_h numeric not null default 1,
      dimensions_d numeric not null default 1,
      processing_status text not null default 'idle',
      created_at timestamptz not null default now(),
      constraint furniture_models_category_check check(category in ('sofa','wardrobe','dining-table','office','bed','tv-stand','bookshelf'))
    );
    create table public.merchant_stores(
      id text primary key,
      owner_id uuid not null unique references auth.users(id),
      name text not null default 'Store',
      store_type text not null,
      active boolean not null default true
    );
    create table public.kitchen_garnitures(
      user_id uuid not null references auth.users(id),
      id uuid not null,
      name text not null default 'Kitchen',
      design jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      primary key(user_id,id)
    );
  `);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260922023456_kitchen_marketplace_foundation.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260922042639_kitchen_module_catalog_seed.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260922074642_normalize_kitchen_base_1000.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260923024337_kitchen_ai_render_workflow.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260923032130_kitchen_project_thumbnails.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260923035533_kitchen_marketplace_version_editing.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260923060138_kitchen_review_notifications.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260923084924_clone_published_kitchen_design.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260924060214_kitchen_quote_requests.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20260924060346_kitchen_quote_fk_indexes.sql",
      "utf8",
    ),
  );

  const publisher = randomUUID();
  const retailer = randomUUID();
  const admin = randomUUID();
  const customer = randomUUID();
  const source = randomUUID();
  await db.query("insert into auth.users values($1),($2),($3),($4)", [
    publisher,
    retailer,
    admin,
    customer,
  ]);
  await db.query(
    "insert into profiles values($1,'merchant'),($2,'merchant'),($3,'admin'),($4,'customer')",
    [publisher, retailer, admin, customer],
  );
  await db.query(
    "insert into merchant_stores(id,owner_id,store_type) values('factory-1',$1,'factory'),('retail-1',$2,'retail')",
    [publisher, retailer],
  );
  const kitchen = {
    version: 1,
    layout: "straight",
    room: { width: 4000, depth: 3000, height: 2600 },
    cabinets: [
      {
        id: "base-1",
        type: "base",
        width: 600,
        height: 820,
        depth: 600,
        position: { x: 300, y: 0, z: 300, rotation: 0 },
        productId: "BASE-600-DOORS",
      },
      {
        id: "wall-1",
        type: "wall",
        width: 600,
        height: 720,
        depth: 350,
        position: { x: 300, y: 1400, z: 175, rotation: 0 },
      },
    ],
  };
  await db.query(
    "insert into kitchen_garnitures(user_id,id,name,design,thumbnail_url) values($1,$2,'Oak kitchen',$3,$4)",
    [
      publisher,
      source,
      JSON.stringify(kitchen),
      "https://res.cloudinary.com/demo/image/upload/planner.webp",
    ],
  );
  const payload = {
    title: "Царсан шулуун гал тогоо",
    shortDescription: "Жижиг өрөөнд зориулсан загвар",
    description: "Үйлдвэрийн бэлэн санал",
    style: "modern",
    tags: ["oak", "small-kitchen"],
    pricingMode: "from",
    priceFrom: 3500000,
    leadTimeDays: 21,
    installationIncluded: true,
    warrantyMonths: 24,
    serviceAreas: ["Улаанбаатар"],
    inclusions: ["Шүүгээ"],
    exclusions: ["Цахилгаан хэрэгсэл"],
  };
  const created = (
    await db.query(
      "select public.create_kitchen_marketplace_design($1,$2,'oak-straight-kitchen',$3) result",
      [publisher, source, JSON.stringify(payload)],
    )
  ).rows[0].result;
  assert.ok(created.designId);
  assert.ok(created.versionId);
  const editedPayload = {
    ...payload,
    title: "Зассан царсан гал тогоо",
    priceFrom: 3700000,
  };
  const edited = (
    await db.query(
      "select public.save_kitchen_marketplace_version($1,$2,$3,'edit',$4) result",
      [
        publisher,
        created.designId,
        created.versionId,
        JSON.stringify(editedPayload),
      ],
    )
  ).rows[0].result;
  assert.equal(edited.created, false);
  assert.deepEqual(
    (
      await db.query(
        "select title,price_from from kitchen_design_versions where id=$1",
        [created.versionId],
      )
    ).rows[0],
    {
      title: "Зассан царсан гал тогоо",
      price_from: 3700000,
    },
  );
  await assert.rejects(
    db.query("select public.clone_published_kitchen_design($1,$2,$3)", [
      customer,
      created.designId,
      randomUUID(),
    ]),
    { code: "P0002" },
  );

  await assert.rejects(
    db.query(
      "select public.create_kitchen_marketplace_design($1,$2,'retail-kitchen',$3)",
      [retailer, source, JSON.stringify(payload)],
    ),
    { code: "42501" },
  );
  const sourceMedia = (
    await db.query(
      "select id,kind,source,url,is_primary,metadata->>'origin' origin from kitchen_design_media where version_id=$1",
      [created.versionId],
    )
  ).rows[0];
  assert.deepEqual(
    { ...sourceMedia, id: Boolean(sourceMedia.id) },
    {
      id: true,
      kind: "thumbnail",
      source: "system",
      url: "https://res.cloudinary.com/demo/image/upload/planner.webp",
      is_primary: true,
      origin: "planner_3d_capture",
    },
  );
  const sourceMediaId = sourceMedia.id;
  const renderId = (
    await db.query(
      "select public.request_kitchen_render($1,$2,$3,$4,$5,'openai','gpt-image-2.5-sunburst') id",
      [
        publisher,
        created.designId,
        created.versionId,
        sourceMediaId,
        "Create a photorealistic kitchen render while preserving every cabinet.",
      ],
    )
  ).rows[0].id;
  assert.ok(renderId);
  await assert.rejects(
    db.query(
      "select public.request_kitchen_render($1,$2,$3,$4,$5,'openai','gpt-image-2.5-sunburst')",
      [
        publisher,
        created.designId,
        created.versionId,
        sourceMediaId,
        "Create another photorealistic kitchen render without changing geometry.",
      ],
    ),
    { code: "P0011" },
  );
  await assert.rejects(
    db.query("select public.claim_kitchen_render($1,$2)", [
      publisher,
      renderId,
    ]),
    { code: "42501" },
  );
  const claimed = (
    await db.query("select public.claim_kitchen_render($1,$2) job", [
      admin,
      renderId,
    ])
  ).rows[0].job;
  assert.equal(claimed.model, "gpt-image-2.5-sunburst");
  const outputMediaId = (
    await db.query(
      "select public.complete_kitchen_render($1,$2,$3,$4,$5,$6,$7) id",
      [
        admin,
        renderId,
        "https://res.cloudinary.com/demo/image/upload/ai.webp",
        "AI render",
        1536,
        1024,
        JSON.stringify({
          providerRequestId: "req_test",
          usage: { output_tokens: 10 },
        }),
      ],
    )
  ).rows[0].id;
  assert.ok(outputMediaId);
  assert.deepEqual(
    (
      await db.query(
        "select status,output_media_id,metadata->>'providerRequestId' request_id from kitchen_render_jobs where id=$1",
        [renderId],
      )
    ).rows[0],
    {
      status: "completed",
      output_media_id: outputMediaId,
      request_id: "req_test",
    },
  );
  assert.deepEqual(
    (
      await db.query(
        "select kind,source,is_primary from kitchen_design_media where id=$1",
        [outputMediaId],
      )
    ).rows[0],
    {
      kind: "ai_render",
      source: "ai",
      is_primary: false,
    },
  );
  await db.query("select public.submit_kitchen_design($1,$2,$3)", [
    publisher,
    created.designId,
    created.versionId,
  ]);
  assert.equal(
    (
      await db.query(
        "select review_status from kitchen_design_versions where id=$1",
        [created.versionId],
      )
    ).rows[0].review_status,
    "submitted",
  );
  await assert.rejects(
    db.query("select public.review_kitchen_design($1,$2,$3,'approved','')", [
      publisher,
      created.designId,
      created.versionId,
    ]),
    { code: "42501" },
  );
  await db.query(
    "select public.review_kitchen_design($1,$2,$3,'approved','Looks good')",
    [admin, created.designId, created.versionId],
  );
  assert.deepEqual(
    (
      await db.query(
        "select user_id,kind,title,body,entity_id,read_at,metadata->>'action' action from user_notifications",
      )
    ).rows[0],
    {
      user_id: publisher,
      kind: "kitchen_review",
      title: "Гал тогооны загвар зөвшөөрөгдлөө",
      body: "Looks good",
      entity_id: created.designId,
      read_at: null,
      action: "approved",
    },
  );
  await db.query("select public.publish_kitchen_design($1,$2,$3)", [
    publisher,
    created.designId,
    created.versionId,
  ]);
  assert.equal(
    (
      await db.query(
        "select publication_status from kitchen_designs where id=$1",
        [created.designId],
      )
    ).rows[0].publication_status,
    "published",
  );
  const copiedProjectId = randomUUID();
  const copied = (
    await db.query(
      "select public.clone_published_kitchen_design($1,$2,$3) project",
      [customer, created.designId, copiedProjectId],
    )
  ).rows[0].project;
  assert.equal(copied.id, copiedProjectId);
  assert.equal(copied.name, "Зассан царсан гал тогоо (хуулбар)");
  assert.equal(
    copied.thumbnail_url,
    "https://res.cloudinary.com/demo/image/upload/planner.webp",
  );
  assert.deepEqual(copied.design, kitchen);
  await db.query("select public.clone_published_kitchen_design($1,$2,$3)", [
    customer,
    created.designId,
    copiedProjectId,
  ]);
  assert.deepEqual(
    (
      await db.query(
        "select source_marketplace_design_id,source_marketplace_version_id,count(*)::int n from kitchen_garnitures where user_id=$1 and id=$2 group by 1,2",
        [customer, copiedProjectId],
      )
    ).rows[0],
    {
      source_marketplace_design_id: created.designId,
      source_marketplace_version_id: created.versionId,
      n: 1,
    },
  );
  const quoteKey = randomUUID();
  const quote = (
    await db.query(
      "select public.create_kitchen_quote_request($1,$2,$3,$4,$5,$6,$7) result",
      [
        customer,
        created.designId,
        copiedProjectId,
        quoteKey,
        JSON.stringify({
          name: "Test customer",
          phone: "99112233",
          email: "USER@example.com",
        }),
        JSON.stringify({ widthMm: 4000, depthMm: 3000, heightMm: 2700 }),
        "Oak front requested",
      ],
    )
  ).rows[0].result;
  assert.equal(quote.status, "submitted");
  await db.query(
    "select public.create_kitchen_quote_request($1,$2,$3,$4,$5,$6,$7)",
    [
      customer,
      created.designId,
      copiedProjectId,
      quoteKey,
      JSON.stringify({
        name: "Test customer",
        phone: "99112233",
        email: "USER@example.com",
      }),
      JSON.stringify({ widthMm: 4000, depthMm: 3000, heightMm: 2700 }),
      "Oak front requested",
    ],
  );
  assert.deepEqual(
    (
      await db.query(
        "select count(*)::int n,min(contact_email) email,min(project_snapshot->>'layout') layout from kitchen_quote_requests where customer_id=$1",
        [customer],
      )
    ).rows[0],
    { n: 1, email: "user@example.com", layout: "straight" },
  );
  const merchantQuotes = (
    await db.query("select public.read_merchant_kitchen_quotes($1,0) result", [
      publisher,
    ])
  ).rows[0].result;
  assert.equal(merchantQuotes.length, 1);
  assert.equal(merchantQuotes[0].cabinetCount, 2);
  await db.query(
    "select public.update_merchant_kitchen_quote($1,$2,'quoted','submitted',$3,$4)",
    [publisher, quote.id, 4200000, "Includes installation"],
  );
  const customerQuotes = (
    await db.query("select public.read_customer_kitchen_quotes($1,0) result", [
      customer,
    ])
  ).rows[0].result;
  assert.equal(customerQuotes[0].status, "quoted");
  assert.equal(customerQuotes[0].quotedPrice, 4200000);
  assert.equal(customerQuotes[0].merchantNote, "Includes installation");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from user_notifications where kind='kitchen_quote'",
      )
    ).rows[0].n,
    2,
  );
  await assert.rejects(
    db.query(
      "select public.save_kitchen_marketplace_version($1,$2,$3,'edit',$4)",
      [
        publisher,
        created.designId,
        created.versionId,
        JSON.stringify(editedPayload),
      ],
    ),
    { code: "P0012" },
  );
  await db.query(
    "update kitchen_garnitures set thumbnail_url=$1 where user_id=$2 and id=$3",
    [
      "https://res.cloudinary.com/demo/image/upload/planner-v2.webp",
      publisher,
      source,
    ],
  );
  const next = (
    await db.query(
      "select public.save_kitchen_marketplace_version($1,$2,$3,'new_version',$4) result",
      [
        publisher,
        created.designId,
        created.versionId,
        JSON.stringify({
          ...editedPayload,
          title: "Царсан гал тогоо шинэчлэл",
        }),
      ],
    )
  ).rows[0].result;
  assert.equal(next.created, true);
  assert.equal(next.versionNo, 2);
  assert.deepEqual(
    (
      await db.query(
        "select version_no,review_status,title from kitchen_design_versions where id=$1",
        [next.versionId],
      )
    ).rows[0],
    {
      version_no: 2,
      review_status: "draft",
      title: "Царсан гал тогоо шинэчлэл",
    },
  );
  assert.deepEqual(
    (
      await db.query(
        "select source,url,is_primary from kitchen_design_media where version_id=$1",
        [next.versionId],
      )
    ).rows[0],
    {
      source: "system",
      url: "https://res.cloudinary.com/demo/image/upload/planner-v2.webp",
      is_primary: true,
    },
  );

  await db.exec("set role anon");
  assert.equal(
    (await db.query("select count(*)::int n from kitchen_designs")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int n from kitchen_design_versions"))
      .rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("select count(*)::int n from kitchen_design_media")).rows[0]
      .n,
    2,
  );
  await assert.rejects(db.query("select * from kitchen_design_reviews"), {
    code: "42501",
  });
  await assert.rejects(db.query("select * from kitchen_render_jobs"), {
    code: "42501",
  });
  await assert.rejects(db.query("select * from user_notifications"), {
    code: "42501",
  });
  await assert.rejects(db.query("select * from kitchen_quote_requests"), {
    code: "42501",
  });
  await assert.rejects(
    db.query("select public.read_customer_kitchen_quotes($1,0)", [customer]),
    { code: "42501" },
  );
  await assert.rejects(
    db.query("select public.clone_published_kitchen_design($1,$2,$3)", [
      customer,
      created.designId,
      randomUUID(),
    ]),
    { code: "42501" },
  );
  await assert.rejects(
    db.query(
      "insert into material_definitions(id,name,surface_kind,base_color,roughness) values('bad','Bad','general','#000000',1)",
    ),
    { code: "42501" },
  );
  await db.exec("reset role");

  await db.query("select public.submit_kitchen_design($1,$2,$3)", [
    publisher,
    created.designId,
    next.versionId,
  ]);
  await db.query(
    "select public.review_kitchen_design($1,$2,$3,'approved','Version 2 approved')",
    [admin, created.designId, next.versionId],
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from user_notifications where user_id=$1 and kind='kitchen_review'",
        [publisher],
      )
    ).rows[0].n,
    2,
  );
  await db.query("select public.publish_kitchen_design($1,$2,$3)", [
    publisher,
    created.designId,
    next.versionId,
  ]);
  assert.equal(
    (
      await db.query(
        "select published_version_id from kitchen_designs where id=$1",
        [created.designId],
      )
    ).rows[0].published_version_id,
    next.versionId,
  );
  await db.exec("set role anon");
  assert.equal(
    (await db.query("select title from kitchen_design_versions")).rows[0].title,
    "Царсан гал тогоо шинэчлэл",
  );
  await db.exec("reset role");

  const modelId = randomUUID();
  await db.query(
    `insert into furniture_models(id,category,product_id,name,glb_path,dimensions_w,dimensions_h,dimensions_d)
    values($1,'kitchen-cabinet','base-600-doors','600 doors','r2://bucket/high.glb',.6,.82,.6)`,
    [modelId],
  );
  const moduleId = (
    await db.query("select id from kitchen_modules where code='BASE-600'")
  ).rows[0].id;
  await db.query("select save_kitchen_module_variant($1,$2,$3,$4)", [
    admin,
    modelId,
    moduleId,
    JSON.stringify({
      variantCode: "BASE-600-DOORS",
      opening: "doors",
      doorCount: 2,
      drawerCount: 0,
      isDefault: true,
    }),
  ]);
  assert.equal(
    (await db.query("select count(*)::int n from kitchen_modules")).rows[0].n,
    26,
  );
  assert.deepEqual(
    (
      await db.query(
        "select width_mm,height_mm,depth_mm,cabinet_type from kitchen_modules where code='BASE-1000'",
      )
    ).rows[0],
    {
      width_mm: 1000,
      height_mm: 820,
      depth_mm: 600,
      cabinet_type: "base",
    },
  );
  assert.equal(
    (
      await db.query(
        "select is_default from kitchen_module_variants where furniture_model_id=$1",
        [modelId],
      )
    ).rows[0].is_default,
    true,
  );
  await assert.rejects(
    db.query("select save_kitchen_module_variant($1,$2,$3,$4)", [
      publisher,
      modelId,
      moduleId,
      JSON.stringify({
        variantCode: "BASE-600-DOORS",
        opening: "doors",
        doorCount: 2,
      }),
    ]),
    { code: "42501" },
  );
  assert.equal(
    (await db.query("select count(*)::int n from material_definitions")).rows[0]
      .n,
    6,
  );
});
