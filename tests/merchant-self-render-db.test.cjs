const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");

test("merchant directly renders own images with a lifetime three-render limit per design", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table profiles(id uuid primary key references auth.users(id),role text not null);
    create table merchant_stores(id text primary key,owner_id uuid not null unique references auth.users(id),name text not null default 'Factory',store_type text not null,active boolean not null default true);
    create table furniture_models(id uuid primary key default gen_random_uuid(),category text not null,product_id text,name text not null default '',glb_path text,thumbnail_path text,dimensions_w numeric default 1,dimensions_h numeric default 1,dimensions_d numeric default 1,processing_status text default 'idle',created_at timestamptz default now(),constraint furniture_models_category_check check(category in ('sofa')));
    create table kitchen_garnitures(user_id uuid references auth.users(id),id uuid,name text default 'Kitchen',design jsonb not null,created_at timestamptz default now(),updated_at timestamptz default now(),primary key(user_id,id));`);
  for (const name of [
    "20260922023456_kitchen_marketplace_foundation",
    "20260923024337_kitchen_ai_render_workflow",
    "20260923032130_kitchen_project_thumbnails",
    "20260923035533_kitchen_marketplace_version_editing",
    "20260923060138_kitchen_review_notifications",
    "20260923084924_clone_published_kitchen_design",
    "20260924060214_kitchen_quote_requests",
    "20261002063235_kitchen_marketplace_phase4",
    "20261002073048_kitchen_marketplace_actor_lookup",
    "20261012145215_merchant_kitchen_media_removal",
    "20261012153951_merchant_kitchen_self_render",
  ])
    await db.exec(readFileSync(`supabase/migrations/${name}.sql`, "utf8"));
  const merchant = randomUUID(),
    other = randomUUID(),
    admin = randomUUID(),
    source = randomUUID();
  await db.query("insert into auth.users values($1),($2),($3)", [
    merchant,
    other,
    admin,
  ]);
  await db.query(
    "insert into profiles values($1,'merchant'),($2,'merchant'),($3,'admin')",
    [merchant, other, admin],
  );
  await db.query(
    "insert into merchant_stores(id,owner_id,store_type) values('factory',$1,'factory'),('other',$2,'handmade')",
    [merchant, other],
  );
  const project = {
    version: 1,
    layout: "straight",
    room: { width: 4000, depth: 3000, height: 2600 },
    cabinets: [
      {
        id: "base",
        type: "base",
        width: 600,
        height: 820,
        depth: 600,
        position: { x: 300, y: 0, z: 300, rotation: 0 },
      },
    ],
  };
  await db.query(
    "insert into kitchen_garnitures(user_id,id,design,thumbnail_url) values($1,$2,$3,'https://res.cloudinary.com/demo/image/upload/source.webp')",
    [merchant, source, JSON.stringify(project)],
  );
  const payload = JSON.stringify({
    title: "Gallery removal",
    pricingMode: "from",
    priceFrom: 2000,
  });
  const created = (
    await db.query(
      "select create_kitchen_marketplace_design($1,$2,'gallery-removal',$3) result",
      [merchant, source, payload],
    )
  ).rows[0].result;
  const args = [merchant, created.designId, created.versionId];
  const original = (
    await db.query(
      "select id from kitchen_design_media where version_id=$1 and is_primary",
      [created.versionId],
    )
  ).rows[0].id;

  await db.exec(
    "grant usage on schema auth to service_role; grant select,insert,update on all tables in schema public to service_role; set role service_role",
  );
  assert.equal(
    (
      await db.query(
        "select has_table_privilege(current_user,'auth.users','select') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  const usage = async (design = created.designId) =>
    (
      await db.query("select read_kitchen_design_render_usage($1,$2) usage", [
        merchant,
        design,
      ])
    ).rows[0].usage;
  const request = async (scope = args, media = original) =>
    (
      await db.query(
        "select request_kitchen_render($1,$2,$3,$4,'Preserve the exact kitchen layout','cloudflare','test',true) id",
        [...scope, media],
      )
    ).rows[0].id;
  const claim = (actor, job) =>
    db.query("select claim_kitchen_render($1,$2) job", [actor, job]);
  const finish = async (actor, job) =>
    (
      await db.query(
        "select complete_kitchen_render($1,$2,'https://res.cloudinary.com/demo/image/upload/output.webp','AI image',1024,768,$3) id",
        [actor, job, JSON.stringify({ provider: "cloudflare" })],
      )
    ).rows[0].id;
  const fail = (actor, job) =>
    db.query("select fail_kitchen_render($1,$2,'Provider unavailable','{}')", [
      actor,
      job,
    ]);
  assert.deepEqual(await usage(), {
    limit: 3,
    used: 0,
    enabled: true,
    nextResetAt: null,
  });
  await assert.rejects(
    db.query("select read_kitchen_design_render_usage($1,$2)", [
      other,
      created.designId,
    ]),
    { code: "42501" },
  );
  const photo = (
    await db.query(
      "select add_kitchen_design_media($1,$2,$3,'photo','https://res.cloudinary.com/demo/image/upload/photo.png','Reference photo',false,800,600,'{}') id",
      args,
    )
  ).rows[0].id;
  const first = await request(args, photo);
  assert.equal((await usage()).used, 1);
  await assert.rejects(request(), { code: "P0011" });
  await assert.rejects(claim(other, first), { code: "42501" });
  await assert.rejects(fail(other, first), { code: "42501" });
  const job = (await claim(merchant, first)).rows[0].job;
  assert.equal(
    job.inputImageUrl,
    "https://res.cloudinary.com/demo/image/upload/photo.png",
  );
  await assert.rejects(claim(merchant, first), { code: "P0002" });
  await assert.rejects(finish(other, first), { code: "42501" });
  const output = await finish(merchant, first);
  const saved = (
    await db.query(
      "select status,metadata from kitchen_render_jobs where id=$1",
      [first],
    )
  ).rows[0];
  assert.equal(saved.status, "completed");
  assert.equal(saved.metadata.consentVersion, "kitchen-ai-v1");
  assert.equal(saved.metadata.provider, "cloudflare");
  assert.equal(
    (
      await db.query(
        "select is_primary from kitchen_design_media where id=$1",
        [original],
      )
    ).rows[0].is_primary,
    true,
  );
  await db.query("select remove_kitchen_design_media($1,$2,$3,$4)", [
    ...args,
    output,
  ]);
  assert.equal(
    (await usage()).used,
    1,
    "Deleting an output never refunds a completed render",
  );
  const failed = await request();
  await claim(merchant, failed);
  await fail(merchant, failed);
  assert.equal(
    (await usage()).used,
    1,
    "Failed attempts do not consume successful renders",
  );
  const cancelled = await request();
  await db.query("select cancel_kitchen_render($1,$2,'Cancel test')", [
    merchant,
    cancelled,
  ]);
  assert.equal((await usage()).used, 1);
  // The old store-wide 24-hour allowance is intentionally irrelevant.
  await db.exec("update kitchen_render_policy set requests_per_24h=1");
  const second = await request();
  await claim(admin, second);
  await finish(admin, second);
  const third = await request();
  await claim(merchant, third);
  await finish(merchant, third);
  assert.equal((await usage()).used, 3);
  await assert.rejects(request(), { code: "P0019" });
  const secondDesign = (
    await db.query(
      "select create_kitchen_marketplace_design($1,$2,'independent-design',$3) result",
      [merchant, source, payload],
    )
  ).rows[0].result;
  const source2 = (
    await db.query(
      "select id from kitchen_design_media where version_id=$1 and is_primary",
      [secondDesign.versionId],
    )
  ).rows[0].id;
  const independent = await request(
    [merchant, secondDesign.designId, secondDesign.versionId],
    source2,
  );
  await claim(merchant, independent);
  await finish(merchant, independent);
  assert.equal((await usage(secondDesign.designId)).used, 1);
  assert.equal((await usage()).used, 3);
  await db.query("select set_config('app.kitchen_actor',$1,false)", [admin]);
  await db.query(
    "update kitchen_design_versions set review_status='rejected' where id=$1",
    [created.versionId],
  );
  const version2 = (
    await db.query(
      "select save_kitchen_marketplace_version($1,$2,$3,'new_version',$4) result",
      [merchant, created.designId, created.versionId, payload],
    )
  ).rows[0].result;
  const newVersion =
    typeof version2 === "string" ? version2 : version2.versionId;
  const newSource = (
    await db.query(
      "select id from kitchen_design_media where version_id=$1 and is_primary",
      [newVersion],
    )
  ).rows[0].id;
  await assert.rejects(
    request([merchant, created.designId, newVersion], newSource),
    { code: "P0019" },
  );
  const acl = (
    await db.query(
      "select p.proname,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') browser,has_function_privilege('service_role',p.oid,'execute') service,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('assert_kitchen_render_actor','read_kitchen_design_render_usage','request_kitchen_render','claim_kitchen_render','complete_kitchen_render','fail_kitchen_render')",
    )
  ).rows;
  assert.equal(acl.length, 6);
  for (const row of acl) {
    assert.equal(row.anon, false);
    assert.equal(row.browser, false);
    assert.equal(row.service, true);
    assert.equal(row.prosecdef, false);
  }
  assert.ok(
    (
      await db.query(
        "select 1 from kitchen_marketplace_audit where actor_id=$1 and action='render_completed'",
        [merchant],
      )
    ).rows.length,
  );
  const blocked = await request(
    [merchant, secondDesign.designId, secondDesign.versionId],
    source2,
  );
  await db.exec("update merchant_stores set active=false where id='factory'");
  await assert.rejects(claim(merchant, blocked), { code: "42501" });
  await fail(merchant, blocked);
  await db.exec("update merchant_stores set active=true where id='factory'");
  assert.equal((await usage(secondDesign.designId)).used, 1);
  await db.query("select set_config('app.kitchen_actor',$1,false)", [admin]);
  await db.query(
    "update kitchen_design_versions set review_status='submitted' where id=$1",
    [secondDesign.versionId],
  );
  await assert.rejects(
    request([merchant, secondDesign.designId, secondDesign.versionId], source2),
    { code: "42501" },
  );
  await db.query("select set_config('app.kitchen_actor',$1,false)", [admin]);
  await db.query(
    "update kitchen_design_versions set review_status='changes_requested' where id=$1",
    [secondDesign.versionId],
  );
  await db.exec("update kitchen_render_policy set enabled=false");
  await assert.rejects(
    request([merchant, secondDesign.designId, secondDesign.versionId], source2),
    { code: "P0022" },
  );
});
