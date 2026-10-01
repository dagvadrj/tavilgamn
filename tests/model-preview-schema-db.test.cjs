const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

test("GLB schema migration preserves assets and protects the admin RPC", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table public.profiles (id uuid primary key, role text);
    create table public.merchant_stores (id uuid primary key, name text);
    create table public.furniture_models (
      id uuid primary key, product_id text, name text, category text, image_url text,
      model_requested_by_store_id uuid, model_requested_at timestamptz,
      updated_at timestamptz, model_requested boolean, processing_status text,
      processing_error text, source_glb_path text, glb_path text,
      high_glb_path text, medium_glb_path text, low_glb_path text,
      export_status text not null default 'idle', standard_glb_path text,
      export_job_id uuid, export_error text, export_requested_at timestamptz,
      export_updated_at timestamptz
    );
    insert into public.profiles values ('11111111-2222-4333-8444-555555555555', 'admin');
    insert into public.furniture_models
      (id, name, processing_status, model_requested, glb_path, high_glb_path,
       medium_glb_path, low_glb_path, source_glb_path)
      values ('aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'Sofa', 'ready', true,
        'delivery.glb', 'delivery.glb', 'medium.glb', 'legacy-preview.glb', 'source.glb');
  `);
  const apply = async (name) => db.exec(readFileSync(`supabase/migrations/${name}.sql`, "utf8"));
  await apply("20261001070809_prepare_preview_glb_path");
  let row = (await db.query("select * from public.furniture_models")).rows[0];
  assert.equal(row.preview_glb_path, "legacy-preview.glb");
  assert.equal(row.low_glb_path, "legacy-preview.glb");

  // Expansion is idempotent and never overwrites an already published preview.
  await db.exec("update public.furniture_models set preview_glb_path = 'new-preview.glb'");
  await apply("20261001070809_prepare_preview_glb_path");
  await apply("20261001070901_remove_legacy_glb_columns");
  row = (await db.query("select * from public.furniture_models")).rows[0];
  assert.equal(row.preview_glb_path, "new-preview.glb");
  assert.equal(row.glb_path, "delivery.glb");
  assert.equal(row.source_glb_path, "source.glb");
  for (const key of ["high_glb_path", "medium_glb_path", "low_glb_path"]) {
    assert.equal(key in row, false);
  }
  const actor = "11111111-2222-4333-8444-555555555555";
  const request = (await db.query("select public.admin_3d_model_requests($1) as result", [actor])).rows[0].result[0];
  assert.equal(request.deliveryPath, "delivery.glb");
  assert.equal(request.previewPath, "new-preview.glb");
  assert.equal("highPath" in request, false);
  await assert.rejects(db.query("select public.admin_3d_model_requests(null)"), /Admin required/);
  const access = (await db.query(`select
    has_function_privilege('anon', 'public.admin_3d_model_requests(uuid)', 'execute') as anon,
    has_function_privilege('authenticated', 'public.admin_3d_model_requests(uuid)', 'execute') as authenticated,
    has_function_privilege('service_role', 'public.admin_3d_model_requests(uuid)', 'execute') as service`)).rows[0];
  assert.deepEqual(access, { anon: false, authenticated: false, service: true });

  // Delivery-based exports still work with the old columns physically absent.
  await apply("20260929000000_use_delivery_glb_for_standard_exports");
  const queued = await db.query("select public.request_furniture_model_export($1, $2) as result", [actor, row.id]);
  assert.equal(queued.rows[0].result.status, "queued");
  await db.exec("update public.furniture_models set preview_glb_path = 'next-preview.glb', glb_path = 'next-delivery.glb'");
  assert.equal((await db.query("select preview_glb_path from public.furniture_models")).rows[0].preview_glb_path, "next-preview.glb");
});
