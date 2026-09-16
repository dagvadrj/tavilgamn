const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");

test("merchant isolation, atomic permissions and immutable order fulfillment", async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create table public.profiles(id uuid primary key references auth.users(id), role text not null default 'customer' constraint profiles_role_check check(role in ('customer','admin')));
    alter table public.profiles enable row level security;
    create policy own_profile on public.profiles for select to authenticated using(id=auth.uid());
    grant all on public.profiles to authenticated,service_role;
    create table public.products(id text primary key,data jsonb not null,updated_at timestamptz default now());
    create table public.furniture_models(id uuid primary key,catalog_product_id text references products(id),
      name text not null,category text not null,description text not null default '',base_price bigint not null default 0,
      glb_path text not null,thumbnail_path text,scale double precision not null default 1,
      dimensions_w double precision not null,dimensions_d double precision not null,dimensions_h double precision not null,
      colors jsonb not null,materials jsonb not null,in_stock boolean not null default true);
    grant all on public.furniture_models to service_role;
  `);
  for (const file of ["202609040001_orders.sql", "202609040002_payments.sql", "202609060001_inventory_contact.sql", "202609090001_product_gallery.sql", "20260916072036_merchant_stores_roles.sql"]) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  }
  const admin = randomUUID(), alice = randomUUID(), bob = randomUUID(), customer = randomUUID();
  for (const [id, role] of [[admin,"admin"],[alice,"customer"],[bob,"customer"],[customer,"customer"]]) {
    await db.query("insert into auth.users values($1)",[id]);
    await db.query("insert into profiles values($1,$2)",[id,role]);
  }
  const call = async (sql, args=[]) => (await db.query(sql,args)).rows[0];
  const role = (actor,target,value) => call("select set_merchant_role($1,$2,$3)",[actor,target,value]);
  const storeData = name => ({name,storeType:"retail",city:"Улаанбаатар",district:"",address:"Хаяг",phone:"99001122",description:"",image:"",categories:["sofa"]});
  const saveStore = async (id,name) => (await call("select save_merchant_store($1,$2) as result",[id,JSON.stringify(storeData(name))])).result;
  let sa,sb;
  const product = (id,overrides={}) => ({id,name:id,category:"sofa",description:"",basePrice:100,image:"/test.jpg",images:[],defaultColor:"oak",colors:[{id:"oak",name:"Oak",hex:"#aaaaaa",priceDelta:0}],materials:[{id:"wood",name:"Wood",priceDelta:0}],dimensions:{w:1,d:1,h:1},stockQuantity:20,...overrides});
  const save = (actor,data,create=true,expected=null) => call("select save_merchant_product($1,$2,$3,$4)",[actor,JSON.stringify(data),create,expected]);
  const line = id => ({productId:id,name:id,color:"oak",colorName:"Oak",material:"wood",materialName:"Wood",qty:1,unitPrice:100,lineTotal:100});
  const checkout = async items => (await call(`insert into orders(user_id,idempotency_key,request_hash,items,delivery,subtotal,shipping,total)
    values($1,$2,$3,$4,$5,$6,0,$6) returning id`,[customer,randomUUID(),"a".repeat(64),JSON.stringify(items),JSON.stringify({name:"Customer",phone:"99002233",address:"Delivery address",privateNote:"not shared"}),items.length*100])).id;
  const orders = async actor => (await call("select read_merchant_orders($1,0) as result",[actor])).result;
  const updateOrder = (actor,id,status,expected) => call("select update_merchant_order($1,$2,$3,$4)",[actor,id,status,expected]);
  await t.test("only admins grant merchant access; self and admin role changes are blocked",async()=>{
    await assert.rejects(role(customer,alice,"merchant"),{code:"42501"});
    await assert.rejects(role(admin,admin,"customer"),{code:"42501"});
    await assert.rejects(role(admin,alice,"admin"),{code:"42501"});
    await assert.rejects(saveStore(customer,"no access"),{code:"42501"});
    await role(admin,alice,"merchant"); await role(admin,bob,"merchant");
    sa=await saveStore(alice,"Alice"); sb=await saveStore(bob,"Bob");
    assert.notEqual(sa.id,sb.id); assert.equal(sa.owner_id,undefined);
    assert.equal((await saveStore(alice,"Alice updated")).id,sa.id);
    assert.equal((await call("select count(*)::int as count from merchant_stores")).count,2);
  });
  await t.test("product writes force own store and preserve platform-owned fields",async()=>{
    await save(alice,product("alice-product",{storeIds:[sb.id],rating:5,reviewCount:999,isNew:true,isBestSeller:true,badges:["fake"]}));
    await save(bob,product("bob-product"));
    let row=await call("select * from furniture_models where product_id='alice-product'");
    assert.deepEqual(row.store_ids,[sa.id]); assert.equal(Number(row.rating),0); assert.equal(row.review_count,0); assert.equal(row.is_best_seller,false); assert.deepEqual(row.badges,[]);
    await db.exec("update furniture_models set rating=4.5,review_count=3,is_best_seller=true,badges='[\"verified\"]',glb_path='protected.glb' where product_id='alice-product'");
    await save(alice,product("alice-product",{rating:0,badges:[],storeIds:[sb.id]}),false,20);
    row=await call("select * from furniture_models where product_id='alice-product'");
    assert.equal(Number(row.rating),4.5); assert.equal(row.review_count,3); assert.equal(row.is_best_seller,true); assert.deepEqual(row.badges,["verified"]); assert.equal(row.glb_path,"protected.glb");
    await assert.rejects(save(alice,product("bob-product"),false,20),{code:"P0002"});
    await assert.rejects(save(alice,product("alice-product"),false,19),{code:"P0003"});
    assert.deepEqual((await db.query("select product_id from read_merchant_products($1)",[alice])).rows.map(r=>r.product_id),["alice-product"]);
  });
  let mixedOrder;
  await t.test("mixed-store orders reveal only own immutable lines and own subtotal",async()=>{
    mixedOrder=await checkout([line("alice-product"),line("bob-product")]);
    const a=(await orders(alice))[0],b=(await orders(bob))[0];
    assert.equal(a.id,mixedOrder); assert.equal(a.subtotal,100); assert.equal(a.items.length,1); assert.equal(a.items[0].productId,"alice-product");
    assert.equal(b.items[0].productId,"bob-product");
    for (const key of ["total","shipping","user_id","owner_id","request_hash","order_payments"]) assert.equal(a[key],undefined);
    assert.deepEqual(a.delivery,{name:"Customer",phone:"99002233",address:"Delivery address"});
    await db.query("update furniture_models set store_ids=$1 where product_id='alice-product'",[JSON.stringify([sb.id])]);
    assert.equal((await orders(alice))[0].items[0].productId,"alice-product");
    assert.equal((await orders(bob))[0].items.length,1);
    await db.query("update furniture_models set store_ids=$1 where product_id='alice-product'",[JSON.stringify([sa.id])]);
    await assert.rejects(db.query("update merchant_order_fulfillments set owner_id=$1 where store_id=$2",[bob,sa.id]),{code:"42501"});
  });
  await t.test("merchant fulfillment is sequential, requires payment, and cannot alter other store status",async()=>{
    await assert.rejects(updateOrder(alice,mixedOrder,"processing","pending"),{code:"P0009"});
    await db.query("update orders set status='paid' where id=$1",[mixedOrder]);
    await assert.rejects(updateOrder(alice,mixedOrder,"delivered","pending"),{code:"P0009"});
    await updateOrder(alice,mixedOrder,"processing","pending");
    await assert.rejects(updateOrder(alice,mixedOrder,"shipped","pending"),{code:"P0009"});
    await updateOrder(alice,mixedOrder,"shipped","processing");
    assert.equal((await orders(bob))[0].status,"pending");
    assert.equal((await call("select status from orders where id=$1",[mixedOrder])).status,"paid");
    const bobOnly=await checkout([line("bob-product")]);
    await assert.rejects(updateOrder(alice,bobOnly,"processing","pending"),{code:"P0002"});
    await db.query("update orders set status='cancelled' where id=$1",[mixedOrder]);
    await assert.rejects(updateOrder(alice,mixedOrder,"delivered","shipped"),{code:"P0009"});
  });
  await t.test("ambiguous merchant assignment rejects checkout and rolls back inventory",async()=>{
    await db.query("update furniture_models set store_ids=$1 where product_id='alice-product'",[JSON.stringify([sa.id,sb.id])]);
    const before=(await call("select in_stock from furniture_models where product_id='alice-product'")).in_stock;
    await assert.rejects(checkout([line("alice-product")]),{code:"P0008"});
    assert.equal((await call("select in_stock from furniture_models where product_id='alice-product'")).in_stock,before);
    assert.deepEqual((await db.query("select product_id from read_merchant_products($1)",[alice])).rows,[]);
    await db.query("update furniture_models set store_ids=$1 where product_id='alice-product'",[JSON.stringify([sa.id])]);
  });
  await t.test("revocation disables store and all merchant APIs immediately",async()=>{
    await role(admin,alice,"customer");
    assert.equal((await call("select active from merchant_stores where id=$1",[sa.id])).active,false);
    await assert.rejects(saveStore(alice,"blocked"),{code:"42501"});
    await assert.rejects(save(alice,product("blocked")),{code:"42501"});
    await assert.rejects(orders(alice),{code:"42501"});
    await assert.rejects(checkout([line("alice-product")]),{code:"P0008"});
    await role(admin,alice,"merchant");
    assert.equal((await call("select active from merchant_stores where id=$1",[sa.id])).active,true);
  });
  await t.test("Data API roles cannot promote themselves, invoke server RPCs or read private snapshots",async()=>{
    await db.exec(`set role authenticated; set test.uid='${alice}';`);
    await assert.rejects(db.query("update profiles set role='admin' where id=$1",[alice]),{code:"42501"});
    await assert.rejects(orders(alice),{code:"42501"});
    await assert.rejects(db.query("select * from merchant_order_fulfillments"),{code:"42501"});
    await assert.rejects(db.query("select owner_id from merchant_stores"),{code:"42501"});
    assert.equal((await db.query("select id,name from merchant_stores")).rows.length,2);
    await db.exec("reset role; set role anon;");
    await assert.rejects(role(admin,customer,"merchant"),{code:"42501"});
    await db.exec("reset role;");
  });
});
