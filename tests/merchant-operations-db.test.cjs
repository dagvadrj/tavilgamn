const { test } = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
test('merchant operations enforce scope, stock allocation and feedback lifecycle',async t=>{
 const db=new PGlite();t.after(()=>db.close());
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key,email text);
    grant usage on schema public,auth to service_role;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create table profiles(id uuid primary key references auth.users(id),full_name text,role text not null default 'customer' constraint profiles_role_check check(role in ('customer','admin')));
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

 await db.exec(readFileSync('supabase/migrations/20261018131047_merchant_delivery_workflow.sql','utf8'));
 await db.exec("alter table furniture_models add column archived_at timestamptz;");
 await db.exec(readFileSync('supabase/migrations/20261020231636_merchant_operations_workspace.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261020232614_merchant_branch_stock_guard.sql','utf8'));
 const owner=randomUUID(),other=randomUUID(),buyer=randomUUID(),driver=randomUUID(),warehouse=randomUUID(),sales=randomUUID();
 for(const [id,role] of [[owner,'merchant'],[other,'merchant'],[buyer,'customer'],[driver,'customer'],[warehouse,'customer'],[sales,'customer']]){
   await db.query('insert into auth.users values($1,$2)',[id,`${id}@example.com`]);await db.query('insert into profiles(id,role) values($1,$2)',[id,role]);
 }
 for(const [id,actor] of [['shop',owner],['other',other]]){
   await db.query(`insert into merchant_stores(id,owner_id,store_type,name,city,address,phone) values($1,$2,'retail',$1,'City','Address','99112233')`,[id,actor]);
   await db.query(`insert into furniture_models(id,product_id,name,category,base_price,dimensions_w,dimensions_d,dimensions_h,colors,materials,in_stock,store_ids) values($1,$2,$2,'sofa',100,1,1,1,'[{"id":"oak","name":"Oak","priceDelta":0}]','[{"id":"wood","name":"Wood","priceDelta":0}]',10,$3)`,[randomUUID(),id,JSON.stringify([id])]);
 }
 await db.exec('set role service_role');
 const call=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
 const ops=async(action,data={},actor=owner)=>(await call('select merchant_operations($1,$2,$3) result',[actor,action,JSON.stringify(data)])).result;
 const access=async(actor)=>(await call('select merchant_workspace_access($1) result',[actor])).result;
 const team=async(actor,action,data)=>(await call('select staff_delivery($1,$2,$3) result',[actor,action,JSON.stringify(data)])).result;
 const feedback=async(actor,action,data)=>(await call('select customer_store_feedback($1,$2,$3) result',[actor,action,JSON.stringify(data)])).result;
 let branch1,branch2,driverRecord,driverMember,orderId;
 await t.test('service-only tables and RPCs deny direct authenticated access',async()=>{
   await db.exec('reset role;set role authenticated');
   for(const table of ['merchant_members','merchant_branches','merchant_branch_stock','product_photo_reviews','merchant_order_cases','merchant_assistant_settings','customer_feedback_media']) await assert.rejects(db.query(`select * from ${table}`),{code:'42501'});
   await assert.rejects(db.query('select merchant_operations($1,\'staff\',\'{}\')',[owner]),{code:'42501'});
   await assert.rejects(db.query('select claim_merchant_membership($1,$2)',[driver,`${driver}@example.com`]),{code:'42501'});
   await db.exec('reset role;set role service_role');
 });
 await t.test('branch allocation is bounded by current canonical stock and optimistic snapshots',async()=>{
   await ops('branch',{name:'Misheel',kind:'showroom',address:'Expo'});await ops('branch',{name:'Warehouse',kind:'warehouse',address:'Depot'});
   [branch1,branch2]=(await ops('branches')).branches;
   await ops('allocate',{branchId:branch1.id,productId:'shop',quantity:4,expectedTotal:10,expectedQuantity:0});
   await ops('allocate',{branchId:branch2.id,productId:'shop',quantity:6,expectedTotal:10,expectedQuantity:0});
   await assert.rejects(ops('allocate',{branchId:branch2.id,productId:'shop',quantity:7,expectedTotal:10,expectedQuantity:6}),{code:'P0003'});
   await assert.rejects(ops('allocate',{branchId:branch2.id,productId:'other',quantity:1,expectedTotal:10,expectedQuantity:0}),{code:'P0002'});
   await assert.rejects(ops('branch',{...branch1,active:false}),{code:'22023'});
   await db.query("update furniture_models set in_stock=7 where product_id='shop'");
   const product=(await ops('branches')).products[0];assert.equal(Number(product.assigned),7);assert.equal(product.total,7);
   await assert.rejects(ops('allocate',{branchId:branch2.id,productId:'shop',quantity:1,expectedTotal:10,expectedQuantity:6}),{code:'P0003'});
   await db.query("update furniture_models set in_stock=10 where product_id='shop'");
   assert.equal(Number((await ops('branches')).products[0].assigned),7,'returned stock stays unassigned');
   assert.equal((await ops('branches',{},other)).branches.length,0);
 });
 await t.test('pending membership binds only confirmed server identity and stays scoped after role changes',async()=>{
   driverRecord=(await call("select save_merchant_delivery_staff($1,null,null,'Driver One','99112233','Van',true) result",[owner])).result;
   for(const [actor,role] of [[driver,'driver'],[warehouse,'warehouse'],[sales,'sales']]){
     await ops('member',{name:role+' person',email:`${actor}@example.com`,role,driverId:role==='driver'?driverRecord.id:''});
     await assert.rejects(access(actor),{code:'42501'});
     await call('select claim_merchant_membership($1,$2)',[actor,`${actor}@example.com`]);
     assert.equal((await access(actor)).role,role);
   }
   driverMember=(await ops('staff')).members.find(m=>m.user_id===driver);assert.ok(driverMember);
   await assert.rejects(ops('staff',{},driver),{code:'42501'});await assert.rejects(ops('branches',{},sales),{code:'42501'});
   assert.ok((await ops('branches',{},warehouse)).products.length);
   await assert.rejects(ops('member',{id:driverMember.id,name:'Driver',role:'driver',driverId:driverRecord.id,active:false,version:0},other),{code:'22023'});
 });
 await t.test('driver sees only assigned orders and cannot dispatch, complete or modify unrelated records',async()=>{
   const makeOrder=async()=>{
     const row=await call(`insert into orders(user_id,idempotency_key,request_hash,items,delivery,subtotal,shipping,total) values($1,$2,$3,'[{"productId":"shop","color":"oak","material":"wood","qty":1,"unitPrice":100,"lineTotal":100,"name":"Sofa","colorName":"Oak","materialName":"Wood"}]','{"name":"Buyer","phone":"99112233","address":"Home"}',100,0,100) returning id`,[buyer,randomUUID(),'a'.repeat(64)]);
     await db.query("update orders set status='paid' where id=$1",[row.id]);return row.id;
   };
   orderId=await makeOrder();const unrelated=await makeOrder();
   assert.equal((await team(driver,'read',{stage:'incoming',page:0})).total,0);
   await team(warehouse,'move',{orderId,stage:'preparing',expectedVersion:0});await team(warehouse,'move',{orderId,stage:'prepared',expectedVersion:1});
   await assert.rejects(team(warehouse,'move',{orderId,stage:'shipped',expectedVersion:2}),{code:'42501'});
   await call("select move_merchant_delivery_order($1,$2,'shipped',2,$3)",[owner,orderId,driverRecord.id]);
   assert.equal((await team(driver,'read',{stage:'shipped',page:0})).orders[0].id,orderId);
   await assert.rejects(team(driver,'move',{orderId:unrelated,stage:'delivered',expectedVersion:0}),{code:'42501'});
   await assert.rejects(team(driver,'move',{orderId,stage:'completed',expectedVersion:3}),{code:'42501'});
   await team(driver,'move',{orderId,stage:'delivered',expectedVersion:3});
   await assert.rejects(team(driver,'move',{orderId,stage:'delivered',expectedVersion:3}),{code:'42501'});
   const events=await call("select count(*)::integer n from merchant_operation_events where actor_id=$1 and action='staff_delivery'",[driver]);assert.equal(events.n,1);
   await ops('member',{id:driverMember.id,name:'Driver One',role:'driver',driverId:driverRecord.id,active:false,version:0});
   await assert.rejects(team(driver,'read',{stage:'delivered',page:0}),{code:'42501'});
 });
 await t.test('reviews require delivered own purchases, owned photos and explicit approval before publication',async()=>{
   const payload={orderId,storeId:'shop',productId:'shop',rating:5,body:'Lovely furniture',photos:[]};
   await assert.rejects(feedback(other,'review',payload),{code:'42501'});
   await assert.rejects(feedback(buyer,'review',{...payload,productId:'other'}),{code:'42501'});
   await assert.rejects(feedback(buyer,'review',{...payload,photos:['https://res.cloudinary.com/other.jpg']}),{code:'22023'});
   const mediaId=randomUUID();await call('select feedback_media($1,$2,$3)',[buyer,orderId,mediaId]);
   await call('select feedback_media($1,$2,$3,$4)',[buyer,orderId,mediaId,'https://res.cloudinary.com/test/image/upload/owned.webp']);
   await feedback(buyer,'review',{...payload,photos:['https://res.cloudinary.com/test/image/upload/owned.webp']});
   const readPublic=async()=>(await call("select public_store_feedback(null,'shop') result")).result;
   assert.equal((await readPublic()).reviews.length,0);
   const row=(await ops('reviews')).rows[0];
   await assert.rejects(ops('review',{id:row.id,status:'approved',reply:'Thanks',version:0},other),{code:'P0003'});
   await ops('review',{id:row.id,status:'approved',reply:'Thank you!',version:0},sales);
   const published=await readPublic();assert.equal(published.summary.count,1);assert.equal(published.reviews[0].reply,'Thank you!');assert.equal(published.reviews[0].user_id,undefined);assert.equal(published.reviews[0].order_id,undefined);
   await assert.rejects(ops('review',{id:row.id,status:'rejected',reply:'',version:0}),{code:'P0003'});
   await assert.rejects(feedback(buyer,'review',payload),{code:'23505'});
 });
 await t.test('return cases are recorded without mutating money or automatically restocking',async()=>{
   await feedback(buyer,'case',{orderId,storeId:'shop',kind:'return',reason:'Damaged in transit',photos:[]});
   let row=(await ops('cases')).rows[0];
   await ops('case',{id:row.id,status:'reviewing',reply:'We will inspect this',version:0});
   await assert.rejects(ops('case',{id:row.id,status:'returned',reply:'Received furniture',version:0}),{code:'P0003'});
   const before=(await ops('branches')).products[0].total;
   await ops('case',{id:row.id,status:'returned',reply:'Furniture received, finance review pending',version:1});
   assert.equal((await ops('branches')).products[0].total,before);
   assert.equal((await call('select status from orders where id=$1',[orderId])).status,'delivered');
   assert.equal((await ops('risk')).returned,1);assert.equal((await ops('risk')).cancelled,0);
   assert.equal((await feedback(buyer,'read',{orderId})).cases[0].status,'returned');
 });
 await t.test('FAQ publishing is explicit and settings use versions',async()=>{
   const settings={enabled:true,greeting:'Hello!',fallback:'Please contact the store',faqs:[{question:'Custom dimensions?',answer:'Yes, ask us for a quote.'}],version:0};
   await ops('save_assistant',settings);
   assert.equal((await call("select public_store_feedback('shop',null) result")).result.assistant.faqs.length,1);
   await assert.rejects(ops('save_assistant',settings),{code:'P0003'});
   await ops('save_assistant',{...settings,version:1,enabled:false});
   assert.equal((await call("select public_store_feedback('shop',null) result")).result.assistant,null);
   await assert.rejects(ops('save_assistant',settings,warehouse),{code:'42501'});
 });
 await t.test('branch stock cannot follow a product into another store and archiving frees its allocation',async()=>{
   await assert.rejects(db.query("update furniture_models set store_ids='[\"other\"]' where product_id='shop'"),{code:'22023'});
   const before=(await ops('branches')).products[0].total;
   await db.query("update furniture_models set archived_at=now() where product_id='shop'");
   assert.equal(Number((await call("select coalesce(sum(quantity),0) n from merchant_branch_stock where product_id='shop'")).n),0);
   await db.query("update furniture_models set archived_at=null,store_ids='[\"other\"]' where product_id='shop'");
   const transferred=(await ops('branches',{},other)).products.find(p=>p.id==='shop');assert.equal(transferred.total,before);assert.deepEqual(transferred.stock,{});
 });
});

