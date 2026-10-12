const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");

test("merchant image removal enforces ownership, editable versions and render references; promotes thumbnails and retains audit", async (t) => {
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
  const remove = (media, scope = args) =>
    db.query("select remove_kitchen_design_media($1,$2,$3,$4) result", [
      ...scope,
      media,
    ]);
  await assert.rejects(remove(original, [other, ...args.slice(1)]), {
    code: "42501",
  });
  await assert.rejects(remove(original, [admin, ...args.slice(1)]), {
    code: "42501",
  });
  await assert.rejects(remove(randomUUID()), { code: "P0002" });
  const job = (
    await db.query(
      "select request_kitchen_render($1,$2,$3,$4,'Preserve this kitchen','cloudflare','test',true) id",
      [...args, original],
    )
  ).rows[0].id;
  await assert.rejects(remove(original), { code: "P0020" });
  assert.equal(
    (
      await db.query("select status from kitchen_design_media where id=$1", [
        original,
      ])
    ).rows[0].status,
    "ready",
  );
  await db.query(
    "select cancel_kitchen_render($1,$2,'Cancel fixture render')",
    [merchant, job],
  );
  const add = async (kind = "thumbnail") =>
    (
      await db.query(
        "select add_kitchen_design_media($1,$2,$3,$4,'https://res.cloudinary.com/demo/image/upload/new.png','New image',false,100,100,'{}') id",
        [...args, kind],
      )
    ).rows[0].id;
  const alternative = await add();
  const example = await add("render");
  await db.exec(
    "grant usage on schema auth to service_role; grant select on profiles,merchant_stores,kitchen_designs,kitchen_design_versions,kitchen_design_media,kitchen_render_jobs to service_role; grant update on profiles,kitchen_designs,kitchen_design_versions,kitchen_design_media to service_role; grant insert on kitchen_marketplace_audit to service_role; set role service_role",
  );
  assert.equal(
    (
      await db.query(
        "select has_table_privilege(current_user,'auth.users','select') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  const removed = (await remove(original)).rows[0].result;
  assert.equal(removed.replacementMediaId, alternative);
  await db.exec("reset role");
  const hidden = (
    await db.query(
      "select status,is_primary,metadata from kitchen_design_media where id=$1",
      [original],
    )
  ).rows[0];
  assert.equal(hidden.status, "rejected");
  assert.equal(hidden.is_primary, false);
  assert.equal(hidden.metadata.removedByMerchant, merchant);
  assert.equal(
    (
      await db.query(
        "select is_primary from kitchen_design_media where id=$1",
        [alternative],
      )
    ).rows[0].is_primary,
    true,
  );
  assert.ok(
    (
      await db.query(
        "select actor_id,metadata from kitchen_marketplace_audit where entity_id=$1",
        [original],
      )
    ).rows.some(
      (event) =>
        event.actor_id === merchant && event.metadata.toStatus === "rejected",
    ),
  );
  await remove(example);
  assert.equal(
    (
      await db.query(
        "select id from kitchen_design_media where version_id=$1 and status='ready' and is_primary",
        [created.versionId],
      )
    ).rows[0].id,
    alternative,
  );
  assert.equal(
    (await remove(alternative)).rows[0].result.replacementMediaId,
    null,
  );
  await assert.rejects(
    db.query("select submit_kitchen_design($1,$2,$3)", args),
    { code: "P0010" },
  );
  const current = await add();
  await db.query("select set_config('app.kitchen_actor',$1,true), 1", [
    merchant,
  ]);
  await db.query(
    "update kitchen_design_media set is_primary=true where id=$1",
    [current],
  );
  await db.query("select submit_kitchen_design($1,$2,$3)", args);
  await assert.rejects(remove(current), { code: "42501" });
  await db.query(
    "select review_kitchen_design($1,$2,$3,'approved','Checked')",
    [admin, ...args.slice(1)],
  );
  await db.query("select review_kitchen_design($1,$2,$3,'published','')", [
    admin,
    ...args.slice(1),
  ]);
  await assert.rejects(remove(current), { code: "42501" });
  const next = (
    await db.query(
      "select save_kitchen_marketplace_version($1,$2,$3,'new_version',$4) result",
      [...args, payload],
    )
  ).rows[0].result;
  await assert.rejects(
    remove(current, [merchant, created.designId, next.versionId]),
    { code: "P0002" },
  );
  const nextMedia = (
    await db.query(
      "select id from kitchen_design_media where version_id=$1 and is_primary",
      [next.versionId],
    )
  ).rows[0].id;
  await db.query("update merchant_stores set active=false where id='factory'");
  await assert.rejects(
    remove(nextMedia, [merchant, created.designId, next.versionId]),
    { code: "42501" },
  );
  await db.query("update merchant_stores set active=true where id='factory'");
  await db.query("select archive_kitchen_design($1,$2)", args.slice(0, 2));
  await assert.rejects(
    remove(nextMedia, [merchant, created.designId, next.versionId]),
    { code: "42501" },
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(remove(current), { code: "42501" });
    await db.exec("reset role");
  }
});
