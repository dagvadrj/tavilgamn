const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const migration = readdirSync('supabase/migrations').find(name => name.endsWith('_merchant_delivery_workflow.sql'));
assert.ok(migration, 'Delivery workflow migration must be present');

test('delivery workflow persists real commerce state with ownership, assignment and concurrency checks', async t => {
  const db = new PGlite(); t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    grant usage on schema public,auth to service_role;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create table profiles(id uuid primary key references auth.users(id),role text not null default 'customer' constraint profiles_role_check check(role in ('customer','admin')));
    grant all on profiles to service_role;
    create table products(id text primary key,data jsonb not null,updated_at timestamptz default now());
    create table furniture_models(id uuid primary key,catalog_product_id text references products(id),name text not null,category text not null,description text not null default '',base_price bigint not null default 0,
      glb_path text not null,thumbnail_path text,scale double precision not null default 1,dimensions_w double precision not null,dimensions_d double precision not null,dimensions_h double precision not null,
      colors jsonb not null,materials jsonb not null,in_stock boolean not null default true,processing_status text not null default 'idle',updated_at timestamptz not null default now());
    grant all on furniture_models to service_role;
  `);
  for (const file of ['202609040001_orders.sql','202609040002_payments.sql','202609060001_inventory_contact.sql','202609090001_product_gallery.sql',
    '20260916072036_merchant_stores_roles.sql','20260916180746_merchant_checkout_lock.sql','20260918000000_model_processing_pipeline_recovery.sql',
    '20260919125623_merchant_commission_featured_and_3d_requests.sql','20260919125726_snapshot_merchant_commission_on_orders.sql','20260919130629_merchant_product_3d_request_save.sql',
    '20261001092640_architecture_store_directory.sql','20261002131851_marketplace_order_operations.sql']) await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  const alice = randomUUID(), bob = randomUUID(), buyer = randomUUID();
  for (const [actor, role] of [[alice,'merchant'],[bob,'merchant'],[buyer,'customer']]) {
    await db.query('insert into auth.users values($1)', [actor]); await db.query('insert into profiles values($1,$2)', [actor,role]);
  }
  for (const [store, actor] of [['alice',alice],['bob',bob]]) {
    await db.query(`insert into merchant_stores(id,owner_id,store_type,name,city,district,address,phone,description,image,categories) values($1,$2,'retail',$1,'City','','Address','99001122','','','["sofa"]')`, [store,actor]);
    await db.query(`insert into furniture_models(id,product_id,name,category,base_price,dimensions_w,dimensions_d,dimensions_h,colors,materials,in_stock,store_ids)
      values($1,$2,$2,'sofa',100,1,1,1,'[{"id":"oak","name":"Oak","priceDelta":0}]','[{"id":"wood","name":"Wood","priceDelta":0}]',1000,$3)`, [randomUUID(),store,JSON.stringify([store])]);
  }
  const call = async (sql, args = []) => (await db.query(sql,args)).rows[0];
  const createOrder = async (stores = ['alice'], paid = true) => {
    const items = stores.map(productId => ({ productId,name:productId,color:'oak',colorName:'Oak',material:'wood',materialName:'Wood',qty:1,unitPrice:100,lineTotal:100 }));
    const order = (await call(`insert into orders(user_id,idempotency_key,request_hash,items,delivery,subtotal,shipping,total) values($1,$2,$3,$4,'{"name":"Buyer","phone":"99001122","address":"Original address"}',$5,0,$5) returning id`, [buyer,randomUUID(),'a'.repeat(64),JSON.stringify(items),stores.length*100])).id;
    if (paid) await db.query("update orders set status='paid' where id=$1",[order]);
    return order;
  };
  const legacy = [];
  for (let step = 0; step < 4; step++) {
    const order = await createOrder(); legacy.push(order);
    let previous = 'pending';
    for (const status of ['processing','shipped','delivered'].slice(0,step)) {
      await call('select update_merchant_order($1,$2,$3,$4)',[alice,order,status,previous]); previous = status;
    }
  }
  await db.exec(readFileSync(`supabase/migrations/${migration}`, 'utf8'));
  await db.exec('set role service_role');
  const move = async (order, stage, version, driver = null, actor = alice) => (await call('select move_merchant_delivery_order($1,$2,$3,$4,$5) result',[actor,order,stage,version,driver])).result;
  const read = async (stage, page = 0, actor = alice) => (await call('select read_merchant_delivery_orders($1,$2,$3) result',[actor,stage,page])).result;
  const staff = async (actor = alice, previous = null, overrides = {}) => (await call('select save_merchant_delivery_staff($1,$2,$3,$4,$5,$6,$7) result',[
    actor,previous?.id ?? null,previous?.version ?? null,overrides.name ?? 'Test Driver',overrides.phone ?? '99112233',overrides.vehicle ?? 'Porter ABC123',overrides.active ?? true,
  ])).result;
  const fulfillment = order => call('select * from merchant_order_fulfillments where order_id=$1 and store_id=$2',[order,'alice']);
  let driver;

  await t.test('existing fulfillment progress is preserved during migration', async () => {
    for (let i = 0; i < legacy.length; i++) assert.equal((await fulfillment(legacy[i])).delivery_stage, ['incoming','preparing','shipped','delivered'][i]);
    assert.equal((await read('shipped')).orders[0].driver, null, 'historical dispatches are not assigned an invented driver');
  });
  await t.test('staff is owned, validated, versioned and service-only', async () => {
    driver = await staff(); assert.equal(driver.version,0);
    await assert.rejects(staff(alice,null,{phone:'bad'}),{code:'22023'});
    await assert.rejects(staff(bob,driver),{code:'P0002'});
    const updated = await staff(alice,driver,{vehicle:'Updated plate'}); assert.equal(updated.version,1);
    await assert.rejects(staff(alice,driver),{code:'P0020'}); driver = updated;
    assert.deepEqual((await call('select read_merchant_delivery_staff($1) result',[bob])).result,[]);
    await db.exec('reset role; set role authenticated');
    await assert.rejects(db.query('select * from merchant_delivery_staff'),{code:'42501'});
    await assert.rejects(db.query('select read_merchant_delivery_staff($1)',[alice]),{code:'42501'});
    await assert.rejects(db.query('select move_merchant_delivery_order($1,$2,$3,0,null)',[alice,legacy[0],'preparing']),{code:'42501'});
    await db.exec('reset role; set role service_role');
  });
  await t.test('only next steps advance and duplicate/stale writes do not add events', async () => {
    const order = await createOrder(); await assert.rejects(move(order,'prepared',0),{code:'P0009'});
    await assert.rejects(move(order,'preparing',0,null,bob),{code:'P0002'});
    await move(order,'preparing',0); await assert.rejects(move(order,'preparing',0),{code:'P0009'});
    await assert.rejects(move(order,'prepared',0),{code:'P0009'});
    await move(order,'prepared',1); assert.equal((await fulfillment(order)).status,'processing');
    await assert.rejects(move(order,'shipped',2),{code:'P0020'});
    const foreign = await staff(bob); await assert.rejects(move(order,'shipped',2,foreign.id),{code:'P0020'});
    const inactive = await staff(alice,null,{active:false}); await assert.rejects(move(order,'shipped',2,inactive.id),{code:'P0020'});
    await move(order,'shipped',2,driver.id);
    const original = (await read('shipped')).orders.find(item => item.id === order).driver;
    driver = await staff(alice,driver,{name:'Renamed Driver',active:false});
    assert.deepEqual((await read('shipped')).orders.find(item => item.id === order).driver,original,'historical dispatch contact is immutable');
    await move(order,'delivered',3); await move(order,'completed',4);
    const final = await fulfillment(order); assert.equal(final.delivery_version,5); assert.ok(final.delivery_completed_at); assert.equal(final.status,'delivered');
    await assert.rejects(move(order,'preparing',5),{code:'P0009'});
    assert.equal((await call('select count(*)::int n from commerce_order_events where order_id=$1',[order])).n,5);
    assert.equal((await call('select status from orders where id=$1',[order])).status,'delivered');
  });
  await t.test('unpaid and cancellation-review orders are held; cancelled orders are excluded', async () => {
    const unpaid = await createOrder(['alice'],false); await assert.rejects(move(unpaid,'preparing',0),{code:'P0009'});
    const held = await createOrder(); await call('select request_order_cancellation($1,$2,$3)',[buyer,held,'Please cancel this order']);
    await assert.rejects(move(held,'preparing',0),{code:'P0009'});
    const visible = (await read('incoming')).orders.find(item => item.id === held); assert.equal(visible.cancellationStatus,'requested');
    const cancelled = await createOrder(['alice'],false); await call('select request_order_cancellation($1,$2,$3)',[buyer,cancelled,'Please cancel this unpaid order']);
    assert.ok(!(await read('incoming')).orders.some(item => item.id === cancelled));
  });
  await t.test('legacy order buttons cannot bypass staff assignment and stage rules', async () => {
    const order = await createOrder(); await call("select update_merchant_order($1,$2,'processing','pending')",[alice,order]);
    assert.equal((await fulfillment(order)).delivery_stage,'preparing');
    await assert.rejects(call("select update_merchant_order($1,$2,'shipped','processing')",[alice,order]),{code:'P0009'});
  });
  await t.test('pagination is per stage and completed orders remain separate', async () => {
    for (let i = 0; i < 23; i++) await createOrder(['bob']);
    const first = await read('incoming',0,bob), second = await read('incoming',1,bob);
    assert.equal(first.total,23); assert.equal(first.orders.length,20); assert.equal(first.hasMore,true);
    assert.equal(second.orders.length,3); assert.equal(second.hasMore,false);
    assert.equal(new Set([...first.orders,...second.orders].map(item=>item.id)).size,23);
    assert.equal((await read('prepared',0,bob)).total,0);
  });
  await t.test('merchant delivery never completes another store fulfillment in a mixed order', async () => {
    const order = await createOrder(['alice','bob']), activeDriver = await staff();
    await move(order,'preparing',0); await move(order,'prepared',1); await move(order,'shipped',2,activeDriver.id); await move(order,'delivered',3); await move(order,'completed',4);
    assert.equal((await call('select status from orders where id=$1',[order])).status,'processing');
    assert.equal((await call("select status from merchant_order_fulfillments where order_id=$1 and store_id='bob'",[order])).status,'pending');
  });
  await t.test('role revocation and inactive stores reject writes using current server permissions', async () => {
    await db.query("update profiles set role='customer' where id=$1",[bob]);
    await assert.rejects(staff(bob),{code:'42501'});
    await db.query("update merchant_stores set active=false where id='alice'");
    await assert.rejects(move(legacy[0],'preparing',0),{code:'42501'});
  });
});
