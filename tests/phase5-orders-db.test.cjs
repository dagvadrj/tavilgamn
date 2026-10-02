const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");

test("Combined Phase 5 migrations preserve locked catalog snapshots, inventory, payment evidence and ACL", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    grant usage on schema public,auth to service_role;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create table public.profiles(id uuid primary key references auth.users(id),role text not null default 'customer' constraint profiles_role_check check(role in ('customer','admin')));
    grant all on public.profiles to service_role;
    create table public.products(id text primary key,data jsonb not null,updated_at timestamptz default now());
    create table public.furniture_models(id uuid primary key,catalog_product_id text references products(id),
      name text not null,category text not null,description text not null default '',base_price bigint not null default 0,
      glb_path text not null,thumbnail_path text,scale double precision not null default 1,
      dimensions_w double precision not null,dimensions_d double precision not null,dimensions_h double precision not null,
      colors jsonb not null,materials jsonb not null,in_stock boolean not null default true,
      processing_status text not null default 'idle',updated_at timestamptz not null default now());
    grant all on public.furniture_models to service_role;
  `);
  for (const file of [
    "202609040001_orders.sql", "202609040002_payments.sql", "202609060001_inventory_contact.sql",
    "202609090001_product_gallery.sql", "20260916072036_merchant_stores_roles.sql",
    "20260916180746_merchant_checkout_lock.sql", "20260918000000_model_processing_pipeline_recovery.sql",
    "20260919125623_merchant_commission_featured_and_3d_requests.sql", "20260919125726_snapshot_merchant_commission_on_orders.sql",
    "20260919130629_merchant_product_3d_request_save.sql",
    "20261001092640_architecture_store_directory.sql", "20261002131851_marketplace_order_operations.sql",
  ]) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  // The archive columns are supplied by the earlier GLB standard migration in
  // production. This commerce fixture omits its unrelated kitchen/model ledger.
  await db.exec("alter table furniture_models add column archived_at timestamptz, add column archived_by uuid references profiles(id)");
  await db.exec(readFileSync("supabase/migrations/20261002131913_marketplace_product_commerce.sql", "utf8"));
  const admin = randomUUID(), buyer = randomUUID(), stranger = randomUUID(), alice = randomUUID(), bob = randomUUID();
  for (const [actor, role] of [[admin,"admin"],[buyer,"customer"],[stranger,"customer"],[alice,"merchant"],[bob,"merchant"]]) {
    await db.query("insert into auth.users values($1)",[actor]);
    await db.query("insert into public.profiles values($1,$2)",[actor,role]);
  }
  await db.query(`insert into merchant_stores(id,owner_id,store_type,name,city,district,address,phone,description,image,categories)
    values('alice',$1,'retail','Alice','City','','Address','99001122','','','["sofa"]'),('bob',$2,'retail','Bob','City','','Address','99001122','','','["sofa"]')`,[alice,bob]);
  const product = async (id,storeIds=[],stock=20) => db.query(`insert into furniture_models(id,product_id,name,category,base_price,dimensions_w,dimensions_d,dimensions_h,colors,materials,in_stock,store_ids)
    values($1,$2,$2,'sofa',100,1,1,1,'[{"id":"oak","name":"Oak","priceDelta":0}]','[{"id":"wood","name":"Wood","priceDelta":0}]',$3,$4)`,[randomUUID(),id,stock,JSON.stringify(storeIds)]);
  await product("platform"); await product("alice-product",["alice"]); await product("bob-product",["bob"]); await product("last-unit",[],1);
  const line = id => ({productId:id,name:`Snapshot ${id}`,image:"/original.jpg",color:"oak",colorName:"Oak",material:"wood",materialName:"Wood",qty:1,unitPrice:100,lineTotal:100});
  const checkout = async (ids=["platform"],key=randomUUID()) => (await db.query(`insert into orders(user_id,idempotency_key,request_hash,items,delivery,subtotal,shipping,total)
    values($1,$2,$3,$4,'{"name":"Buyer","phone":"99001122","address":"Original address"}',$5,0,$5) returning id`,[buyer,key,"a".repeat(64),JSON.stringify(ids.map(line)),ids.length*100])).rows[0].id;
  const call = async (sql,args=[]) => (await db.query(sql,args)).rows[0];
  const order = id => call("select * from orders where id=$1",[id]);
  const stock = async id => (await call("select in_stock from furniture_models where product_id=$1",[id])).in_stock;
  const cancel = async (id,actor=buyer,reason="Changed my mind") => (await call("select request_order_cancellation($1,$2,$3) as result",[actor,id,reason])).result;
  const claim = async (id,method="qpay",actor=buyer) => (await call("select claim_order_payment($1,$2,$3,$4) as result",[actor,id,method,"a".repeat(64)])).result;
  const paid = async (id,method="qpay",actor=null) => {
    const row = await order(id);
    await call("select confirm_order_payment($1,$2,$3,$4,$5)",[id,method,`payment-${id}`,row.total,actor]);
  };
  const resolve = async (id,action="approve",reference=null,amount=null,actor=admin) => (await call("select resolve_order_cancellation($1,$2,$3,$4,$5,$6) as result",[actor,id,action,"Externally verified payment and fulfillment",reference,amount])).result;
  await db.exec("set role service_role;");

  await t.test("parallel last-unit attempts reserve once; duplicate order rolls back reservation",async()=>{
    const key=randomUUID();
    const results=await Promise.allSettled([checkout(["last-unit"],key),checkout(["last-unit"],key),checkout(["last-unit"])]);
    assert.equal(results.filter(x=>x.status==="fulfilled").length,1);
    assert.equal(await stock("last-unit"),0);
    assert.equal((await call("select count(*)::int as n from orders where items @> '[{\"productId\":\"last-unit\"}]'")).n,1);
  });
  await t.test("un-invoiced cancellation is immediate, idempotent and returns inventory only once",async()=>{
    const before=await stock("platform"),id=await checkout();
    await assert.rejects(cancel(id,stranger),{code:"P0002"});
    const result=await cancel(id);
    assert.equal(result.cancellation.status,"approved"); assert.equal(result.orderStatus,"cancelled");
    assert.equal((await order(id)).stock_reserved,false); assert.equal(await stock("platform"),before);
    await cancel(id); assert.equal(await stock("platform"),before);
    await assert.rejects(claim(id),{code:"P0016"});
    await assert.rejects(db.query("update orders set status='paid' where id=$1",[id]));
  });
  await t.test("order identity, delivery, money and original line metadata cannot be rewritten/deleted",async()=>{
    const id=await checkout();
    for (const column of ["items='[{\"qty\":99}]'", "delivery='{}'", "shipping=1,total=101", "request_hash='"+"b".repeat(64)+"'", "created_at=now()+interval '1 day'"]) {
      await assert.rejects(db.query(`update orders set ${column} where id=$1`,[id]),{code:"42501"});
    }
    await assert.rejects(db.query("delete from orders where id=$1",[id]),{code:"42501"});
    await db.exec("update furniture_models set name='Changed current catalog' where product_id='platform'");
    assert.equal((await order(id)).items[0].name,"platform");
  });
  await t.test("incorrect stored line math cannot be persisted and inventory rolls back",async()=>{
    const before=await stock("platform");
    await assert.rejects(db.query(`insert into orders(user_id,idempotency_key,request_hash,items,delivery,subtotal,shipping,total)
      values($1,$2,$3,$4,'{"name":"Buyer","phone":"99001122","address":"Address"}',1,0,1)`,
      [buyer,randomUUID(),"a".repeat(64),JSON.stringify([{...line("platform"),lineTotal:1}])]),{code:"22023"});
    assert.equal(await stock("platform"),before);
  });
  await t.test("invoice claim and cancellation serialize; pending request blocks new invoice and fulfillment",async()=>{
    const id=await checkout(),first=await claim(id);
    assert.equal(first.claimed,true); assert.equal((await claim(id)).claimed,false);
    assert.equal(first.payment.callback_token,undefined);
    await db.query("update order_payments set state='ready',invoice_id='invoice' where order_id=$1",[id]);
    const result=await cancel(id); assert.equal(result.cancellation.status,"requested"); assert.equal(result.orderStatus,"pending_payment");
    await assert.rejects(claim(id),{code:"P0016"});
    await assert.rejects(resolve(id,"approve",null,null,buyer),{code:"42501"});
    await resolve(id,"reject"); assert.equal((await claim(id)).claimed,false);
  });
  await t.test("paid cancellation requires full externally recorded refund; references and event replay idempotent",async()=>{
    const id=await checkout(); await claim(id); await paid(id); await cancel(id);
    assert.equal((await resolve(id)).cancellation.status,"approved");
    assert.equal((await order(id)).status,"cancelled");
    assert.equal((await call("select requires_review from order_payments where order_id=$1",[id])).requires_review,true);
    await assert.rejects(resolve(id,"record_refund","refund-test",99),{code:"P0016"});
    const refunded=await resolve(id,"record_refund",`refund-${id}`,100);
    assert.equal(refunded.cancellation.status,"refunded");
    assert.equal((await call("select requires_review from order_payments where order_id=$1",[id])).requires_review,false);
    await resolve(id,"record_refund",`refund-${id}`,100);
    assert.equal((await call("select count(*)::int as n from commerce_order_events where order_id=$1 and event='refund_recorded'",[id])).n,1);
    await assert.rejects(resolve(id,"record_refund","different-ref",100),{code:"P0016"});
    await assert.rejects(db.query("update order_cancellations set review_note='rewrite' where order_id=$1",[id]),{code:"42501"});
    await assert.rejects(db.query("update commerce_order_events set details='{}' where order_id=$1",[id]),{code:"42501"});
  });
  await t.test("verified late payments on cancelled orders are retained for review, not silently lost or reopened",async()=>{
    const id=await checkout(); await claim(id);
    await db.query("update order_payments set state='ready',invoice_id='invoice-late' where order_id=$1",[id]);
    await cancel(id); await resolve(id); await paid(id); await paid(id);
    assert.equal((await order(id)).status,"cancelled");
    const payment=await call("select state,requires_review from order_payments where order_id=$1",[id]);
    assert.deepEqual(payment,{state:"paid",requires_review:true});
    assert.equal((await call("select count(*)::int as n from commerce_order_events where order_id=$1 and event='late_payment_review'",[id])).n,1);
    await resolve(id,"record_refund",`late-refund-${id}`,100);
  });
  await t.test("manual bank settlement freshly verifies admin role and provider settlements do not accept manual actor",async()=>{
    const id=await checkout(); await claim(id,"bank_transfer");
    await assert.rejects(paid(id,"bank_transfer",buyer),{code:"42501"});
    await paid(id,"bank_transfer",admin);
    const q=await checkout(); await claim(q);
    await assert.rejects(paid(q,"qpay",admin),{code:"22023"});
    await paid(q);
    assert.equal((await call("select prosecdef from pg_proc where proname='confirm_order_payment'")).prosecdef,false);
  });
  await t.test("merchant and platform progress aggregate only after every immutable batch reaches stage",async()=>{
    const id=await checkout(["alice-product","bob-product","platform"]); await claim(id); await paid(id);
    const progress=(actor,next,previous)=>call("select update_merchant_order($1,$2,$3,$4)",[actor,id,next,previous]);
    await progress(alice,"processing","pending"); assert.equal((await order(id)).status,"processing");
    await progress(alice,"shipped","processing"); await progress(alice,"delivered","shipped");
    assert.equal((await order(id)).status,"processing");
    await assert.rejects(progress(bob,"delivered","pending"),{code:"P0009"});
    await progress(bob,"processing","pending"); await progress(bob,"shipped","processing"); await progress(bob,"delivered","shipped");
    assert.equal((await order(id)).status,"processing");
    await call("select update_platform_order($1,$2,'processing','pending')",[admin,id]);
    await call("select update_platform_order($1,$2,'shipped','processing')",[admin,id]); assert.equal((await order(id)).status,"shipped");
    await assert.rejects(cancel(id),{code:"P0016"});
    await call("select update_platform_order($1,$2,'delivered','shipped')",[admin,id]); assert.equal((await order(id)).status,"delivered");
    await assert.rejects(db.query("update merchant_order_fulfillments set commission_bps=300 where order_id=$1",[id]),{code:"42501"});
    await assert.rejects(db.query("update orders set status='cancelled' where id=$1",[id]),{code:"P0016"});
  });
  await t.test("authenticated/anon cannot access private cancellations/audit or invoke server-only RPCs",async()=>{
    await db.exec("reset role; set role authenticated;");
    for (const table of ["order_cancellations","commerce_order_events","order_payments","merchant_order_fulfillments"]) {
      await assert.rejects(db.query(`select * from ${table}`),{code:"42501"});
    }
    await assert.rejects(cancel(randomUUID()),{code:"42501"});
    await db.exec("reset role; set role anon;");
    await assert.rejects(claim(randomUUID()),{code:"42501"});
    await db.exec("reset role;");
  });
});
