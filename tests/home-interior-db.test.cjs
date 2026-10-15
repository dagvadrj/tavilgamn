const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

test("homepage choices are server-only and reject empty, duplicate, null or extra products", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users (id uuid primary key);");
  for (const file of ["20261014122058_homepage_scene_settings.sql", "20261014122337_homepage_scene_bounds.sql"]) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  const ids = ["2b9cdc29-650f-4574-83ee-c3b6092d6ef8", "0f05288c-7957-4c08-8c1b-d7e1e650c712"];
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query("select * from public.homepage_scene_settings"), /permission denied/);
    await assert.rejects(db.query("insert into public.homepage_scene_settings (product_ids) values ($1)", [ids]), /permission denied/);
    await assert.rejects(db.query("update public.homepage_scene_settings set version=2"), /permission denied/);
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  for (const invalid of [[], [ids[0]], [ids[0], ids[0]], [ids[0], null], [...ids, ids[0]]]) await assert.rejects(db.query("insert into public.homepage_scene_settings (product_ids) values ($1)", [invalid]), /check constraint/);
  await db.query("insert into public.homepage_scene_settings (product_ids) values ($1)", [ids]);
  assert.deepEqual((await db.query("select product_ids, version from public.homepage_scene_settings")).rows, [{ product_ids: ids, version: 1 }]);
  await assert.rejects(db.query("delete from public.homepage_scene_settings"), /permission denied/);
});
