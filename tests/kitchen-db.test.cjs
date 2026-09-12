const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');

test('kitchen migration enforces owner CRUD, immutable ownership, anonymous denial and update timestamps', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  await db.exec(readFileSync('supabase/migrations/20260912125410_kitchen_garnitures.sql','utf8'));
  const a = randomUUID(), b = randomUUID(), id = randomUUID();
  await db.query('insert into auth.users values($1),($2)',[a,b]);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
  await db.exec('set role authenticated');
  const created = (await db.query("insert into kitchen_garnitures(user_id,id,name,design) values($1,$2,'Original','{}') returning *",[a,id])).rows[0];
  await assert.rejects(db.query("insert into kitchen_garnitures(user_id,id,name,design) values($1,$2,'Forged','{}')",[b,id]), {code:'42501'});
  await assert.rejects(db.query('update kitchen_garnitures set user_id=$1 where id=$2',[b,id]),{code:'42501'});
  const updated = (await db.query("update kitchen_garnitures set name='Changed',created_at='2000-01-01',updated_at='2000-01-01' returning *")).rows[0];
  assert.equal(+updated.created_at,+created.created_at); assert.ok(+updated.updated_at >= +created.updated_at);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
  assert.deepEqual((await db.query('select * from kitchen_garnitures')).rows,[]);
  assert.deepEqual((await db.query("update kitchen_garnitures set name='Other' where id=$1 returning *",[id])).rows,[]);
  assert.deepEqual((await db.query('delete from kitchen_garnitures where id=$1 returning *',[id])).rows,[]);
  // Same design UUID under another owner is a separate row, never an overwrite.
  await db.query("insert into kitchen_garnitures(user_id,id,name,design) values($1,$2,'Mine','{}')",[b,id]);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select * from kitchen_garnitures'),{code:'42501'});
  await db.exec('reset role');
  assert.equal((await db.query('select count(*)::int n from kitchen_garnitures')).rows[0].n,2);
  assert.equal((await db.query("select count(*)::int n from pg_policies where tablename='kitchen_garnitures'")).rows[0].n,4);
  await db.exec('set role authenticated');
  assert.equal((await db.query('delete from kitchen_garnitures where id=$1 returning *',[id])).rows.length,1);
});
