const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { randomUUID } = require('node:crypto');
test('merchant standard export locks fresh ownership, is service-only and idempotent', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table profiles(id uuid primary key,role text);
    create table merchant_stores(id text primary key,owner_id uuid,active boolean);
    create table furniture_models(id uuid primary key,product_id text,store_ids jsonb,archived_at timestamptz,
      processing_status text,glb_path text,export_status text default 'idle',standard_glb_path text,
      export_job_id uuid,export_error text,export_requested_at timestamptz,export_updated_at timestamptz);
    grant all on profiles,merchant_stores,furniture_models to service_role;`);
  const guard = readFileSync('supabase/migrations/20261018131047_merchant_delivery_workflow.sql','utf8');
  await db.exec(guard.slice(guard.indexOf('create function public.merchant_delivery_store'), guard.indexOf('create function public.read_merchant_delivery_staff')));
  const migration = readdirSync('supabase/migrations').find(n => n.endsWith('_merchant_standard_glb_exports.sql'));
  await db.exec(readFileSync(`supabase/migrations/${migration}`,'utf8'));
  const actor = randomUUID(), stranger = randomUUID(), model = randomUUID();
  await db.query("insert into profiles values($1,'merchant'),($2,'merchant')", [actor,stranger]);
  await db.query("insert into merchant_stores values('own',$1,true),('other',$2,true)", [actor,stranger]);
  await db.query("insert into furniture_models(id,product_id,store_ids,processing_status,glb_path) values($1,'product','[\"own\"]','ready','r2://bucket/delivery.glb')", [model]);
  await db.exec('set role authenticated');
  await assert.rejects(db.query("select request_merchant_model_export($1,'product')",[actor]),{code:'42501'});
  await db.exec('reset role; set role service_role');
  const call = async (user=actor) => (await db.query("select request_merchant_model_export($1,'product') result",[user])).rows[0].result;
  await assert.rejects(call(stranger),{code:'P0002'});
  assert.equal((await call()).status,'queued');
  const job = (await db.query('select export_job_id from furniture_models')).rows[0].export_job_id;
  await call(); assert.equal((await db.query('select export_job_id from furniture_models')).rows[0].export_job_id,job);
  await db.exec("update furniture_models set export_status='processing'"); assert.equal((await call()).status,'processing');
  await db.exec("update furniture_models set export_status='ready',standard_glb_path='r2://bucket/standard.glb'"); assert.equal((await call()).ready,true);
  await db.exec("update merchant_stores set active=false where id='own'"); await assert.rejects(call(),{code:'42501'});
  await db.exec("update merchant_stores set active=true where id='own'; update profiles set role='customer'"); await assert.rejects(call(),{code:'42501'});
});
