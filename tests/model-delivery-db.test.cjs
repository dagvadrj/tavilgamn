const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

test("delivery GLB can queue a standard export through the protected RPC", async () => {
  const db = new PGlite();

  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;

      create table public.profiles (
        id uuid primary key,
        role text not null
      );

      create table public.furniture_models (
        id uuid primary key,
        processing_status text not null,
        glb_path text,
        export_status text not null default 'idle',
        standard_glb_path text,
        export_job_id uuid,
        export_error text,
        export_requested_at timestamptz,
        export_updated_at timestamptz
      );
    `);

    await db.exec(
      readFileSync(
        "supabase/migrations/20260929000000_use_delivery_glb_for_standard_exports.sql",
        "utf8",
      ),
    );

    const actor = "11111111-2222-4333-8444-555555555555";
    const model = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

    await db.query(
      `insert into public.profiles(id, role) values ($1, 'admin')`,
      [actor],
    );
    await db.query(
      `insert into public.furniture_models(id, processing_status, glb_path)
       values ($1, 'ready', $2)`,
      [model, `r2://bucket/models/${model}/delivery/job/model.glb`],
    );

    const queued = await db.query(
      `select public.request_furniture_model_export($1, $2) as result`,
      [actor, model],
    );

    assert.equal(queued.rows[0].result.status, "queued");
    assert.equal(queued.rows[0].result.ready, false);

    const stored = await db.query(
      `select export_status, export_job_id from public.furniture_models where id = $1`,
      [model],
    );

    assert.equal(stored.rows[0].export_status, "queued");
    assert.ok(stored.rows[0].export_job_id);

    await assert.rejects(
      db.query(
        `select public.request_furniture_model_export($1, $2)`,
        ["99999999-2222-4333-8444-555555555555", model],
      ),
      /Admin required/,
    );
  } finally {
    await db.close();
  }
});
