const { test } = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
test('showroom orders reserve physical stock, require delivery evidence and publish scoped quotations',async t=>{
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

 await db.exec(`create schema storage; create table storage.objects(bucket_id text,name text); grant usage on schema storage to service_role; grant select on storage.objects to service_role;
 alter table furniture_models add column delivery_terms text,add column compare_at_price bigint,add column promotion_label text,add column promotion_ends_at timestamptz;
 create table kitchen_quote_requests(id uuid primary key,customer_id uuid,merchant_owner_id uuid,store_id text,project_name text,design_id uuid,status text default 'submitted',quoted_price bigint,merchant_note text,responded_at timestamptz,updated_at timestamptz);
 grant all on kitchen_quote_requests to service_role;
 create table user_notifications(user_id uuid,kind text,title text,body text,href text,entity_id uuid,source_key text unique,metadata jsonb);
 grant all on user_notifications to service_role;
 `);
 await db.exec("create function public.update_merchant_kitchen_quote(\n  p_actor uuid,p_quote uuid,p_status text,p_expected_status text,\n  p_price bigint,p_note text\n) returns void language plpgsql security invoker set search_path='' as $$\ndeclare target_store text; current_quote public.kitchen_quote_requests;\nbegin\n  perform 1 from public.profiles where id=p_actor and role='merchant' for share;\n  if not found then raise exception using errcode='42501',message='Merchant required'; end if;\n  select id into target_store from public.merchant_stores\n    where owner_id=p_actor and active for share;\n  if not found then raise exception using errcode='42501',message='Active store required'; end if;\n\n  select * into current_quote from public.kitchen_quote_requests\n  where id=p_quote and merchant_owner_id=p_actor and store_id=target_store for update;\n  if not found then raise exception using errcode='P0002',message='Kitchen quote not found'; end if;\n  if current_quote.status is distinct from p_expected_status then\n    raise exception using errcode='P0015',message='Kitchen quote changed';\n  end if;\n  if char_length(coalesce(p_note,''))>5000\n    or p_status not in ('reviewing','quoted','closed')\n    or (p_status='reviewing' and current_quote.status<>'submitted')\n    or (p_status='quoted' and (current_quote.status not in ('submitted','reviewing') or p_price is null or p_price<0))\n    or (p_status='closed' and current_quote.status='closed') then\n    raise exception using errcode='22023',message='Invalid kitchen quote transition';\n  end if;\n\n  update public.kitchen_quote_requests set\n    status=p_status,\n    quoted_price=case when p_status='quoted' then p_price else quoted_price end,\n    merchant_note=coalesce(p_note,''),\n    responded_at=case when p_status in ('quoted','closed') then now() else responded_at end,\n    updated_at=now()\n  where id=p_quote;\n\n  insert into public.user_notifications(\n    user_id,kind,title,body,href,entity_id,source_key,metadata\n  ) values(\n    current_quote.customer_id,'kitchen_quote',\n    case p_status when 'reviewing' then '\u04ae\u043d\u0438\u0439\u043d \u0445\u04af\u0441\u044d\u043b\u0442\u0438\u0439\u0433 \u0448\u0430\u043b\u0433\u0430\u0436 \u0431\u0430\u0439\u043d\u0430'\n      when 'quoted' then '\u0413\u0430\u043b \u0442\u043e\u0433\u043e\u043e\u043d\u044b \u04af\u043d\u0438\u0439\u043d \u0441\u0430\u043d\u0430\u043b \u0431\u044d\u043b\u044d\u043d \u0431\u043e\u043b\u043b\u043e\u043e'\n      else '\u0413\u0430\u043b \u0442\u043e\u0433\u043e\u043e\u043d\u044b \u04af\u043d\u0438\u0439\u043d \u0445\u04af\u0441\u044d\u043b\u0442 \u0445\u0430\u0430\u0433\u0434\u043b\u0430\u0430' end,\n    coalesce(p_note,''),'/account#kitchen-quotes',current_quote.id,\n    'kitchen-quote:'||current_quote.id||':'||p_status,\n    jsonb_build_object('designId',current_quote.design_id,'quoteId',current_quote.id,'status',p_status)\n  ) on conflict(source_key) do nothing;\nend;\n$$;\n\n");

 await db.exec(readFileSync('supabase/migrations/20261021001252_merchant_showroom_fulfillment.sql','utf8'));
 const owner=randomUUID(), other=randomUUID(), buyer=randomUUID();
 for(const [id,role] of [[owner,'merchant'],[other,'merchant'],[buyer,'customer']]) { await db.query('insert into auth.users values($1,$2)',[id,id+'@example.com']);await db.query('insert into profiles(id,role) values($1,$2)',[id,role]); }
 for(const [sid,actor] of [['shop',owner],['other',other]]) {
  await db.query("insert into merchant_stores(id,owner_id,store_type,name,city,address,phone) values($1,$2,'retail',$1,'City','Address','99112233')",[sid,actor]);
  await db.query(`insert into furniture_models(id,product_id,name,category,base_price,dimensions_w,dimensions_d,dimensions_h,colors,materials,in_stock,store_ids,glb_path,processing_status) values($1,$2,$2,'sofa',100,1,1,1,'[{"id":"oak","name":"Oak","priceDelta":0}]','[{"id":"wood","name":"Wood","priceDelta":0}]',2,$3,'source.glb','ready')`,[randomUUID(),sid,JSON.stringify([sid])]);
 }
 const call=async(sql,args=[])=>(await db.query(sql,args)).rows[0];
 await db.exec('set role service_role');
 const create=async(qty=1)=> (await call(`insert into orders(user_id,idempotency_key,request_hash,items,delivery,subtotal,shipping,total) values($1,$2,$3,$4,'{"name":"Buyer","phone":"99112233","address":"Home address","floor":7,"elevator":"none","assemblyRequested":true}',$5,0,$5) returning id,items`,[buyer,randomUUID(),'a'.repeat(64),JSON.stringify([{productId:'shop',name:'X',color:'oak',material:'wood',qty,unitPrice:100,lineTotal:100*qty,reservedQuantity:999}]),100*qty]));
 const policy=(enabled,expected,actor=owner)=>call("select merchant_product_policy($1,'shop',$2,$3)",[actor,enabled,expected]);
 await assert.rejects(create(5),{code:'P0004'});
 await assert.rejects(policy(true,false,other),{code:'42501'});await policy(true,false);
 await assert.rejects(policy(false,false),{code:'P0003'});
 const order=await create(5);assert.equal(order.items[0].reservedQuantity,2);assert.equal(order.items[0].madeToOrderQuantity,3);assert.equal((await call("select in_stock from furniture_models where product_id='shop'")).in_stock,0);
 await call("select request_order_cancellation($1,$2,'Changed mind')",[buyer,order.id]);assert.equal((await call("select in_stock from furniture_models where product_id='shop'")).in_stock,2);
 await call("select request_order_cancellation($1,$2,'Changed mind')",[buyer,order.id]);assert.equal((await call("select in_stock from furniture_models where product_id='shop'")).in_stock,2);
 const delivery=await create();await db.query("update orders set status='paid' where id=$1",[delivery.id]);
 const driver=(await call("select save_merchant_delivery_staff($1,null,null,'Driver','99112233','Van',true) data",[owner])).data;
 const move=(stage,version,extras={},actor=owner)=>call('select move_showroom_delivery($1,$2) data',[actor,JSON.stringify({orderId:delivery.id,stage,expectedVersion:version,...extras})]);
 await move('preparing',0);await move('prepared',1);await move('shipped',2,{driverId:driver.id,assemblyTeam:true});
 await assert.rejects(move('delivered',3),{code:'P0024'});
 const path=`${owner}/shop/delivery/${delivery.id}/photo.jpg`;
 await db.exec('reset role');await db.query("insert into storage.objects values('merchant-private',$1)",[path]);await db.exec('set role service_role');
 await assert.rejects(call('select register_delivery_evidence($1,$2,$3)',[other,delivery.id,path]),{code:'42501'});
 await call('select register_delivery_evidence($1,$2,$3)',[owner,delivery.id,path]);await move('delivered',3);await move('completed',4);
 const column=(await call("select read_merchant_delivery_orders($1,'completed',0) data",[owner])).data.orders[0];assert.equal(column.delivery.floor,7);assert.equal(column.assemblyTeam,true);assert.equal(column.proofAvailable,true);
 const quote=randomUUID(), quote2=randomUUID();
 await db.query("insert into kitchen_quote_requests(id,customer_id,merchant_owner_id,store_id,project_name) values($1,$2,$3,'shop','Kitchen'),($4,$2,$3,'shop','Second')",[quote,buyer,owner,quote2]);
 const commerce=(actor,action,data={},id=quote)=>call('select kitchen_commerce($1,$2,$3,$4) data',[actor,id,action,JSON.stringify(data)]).then(x=>x.data);
 await assert.rejects(commerce(other,'read'),{code:'42501'});
 const lines=[{name:'Upper',quantity:2,unit:'piece',unitPrice:100},{name:'Stone',quantity:.29,unit:'m',unitPrice:50}];
 assert.equal((await commerce(owner,'publish',{items:lines,expectedStatus:'submitted',note:'Finish'})).document.total,215);
 await assert.rejects(commerce(owner,'publish',{items:lines,expectedStatus:'submitted',note:''}),{code:'P0015'});
 assert.equal((await commerce(buyer,'read')).document.total,215);
 const startsAt=new Date(Date.now()+86400000).toISOString(),endsAt=new Date(Date.now()+90000000).toISOString();
 await commerce(owner,'schedule',{engineer:'Engineer',startsAt,endsAt});
 await assert.rejects(commerce(owner,'schedule',{engineer:'Engineer',startsAt,endsAt},quote2),{code:'P0003'});
 await assert.rejects(commerce(other,'respond',{status:'confirmed',version:0}),{code:'42501'});
 assert.equal((await commerce(buyer,'respond',{status:'confirmed',version:0})).appointment.status,'confirmed');
 await assert.rejects(commerce(buyer,'respond',{status:'declined',version:0}),{code:'P0003'});
 const session=randomUUID();
 await call("select record_product_3d_event($1,$2,'shop','placement','')",[randomUUID(),session]);await call("select record_product_3d_event($1,$2,'shop','placement','')",[randomUUID(),session]);
 await call("select record_product_3d_event($1,$2,'shop','color','oak')",[randomUUID(),session]);await call("select record_product_3d_event($1,$2,'shop','color','invented')",[randomUUID(),session]);
 const insights=(await call('select merchant_3d_insights($1,7) data',[owner])).data;assert.equal(insights.products[0].placements,1);assert.equal(insights.products[0].options.length,1);assert.equal((await call('select merchant_3d_insights($1,7) data',[other])).data.products[0].placements,0);
 await db.exec('reset role;set role authenticated');await assert.rejects(db.query('select * from merchant_delivery_evidence'),{code:'42501'});await assert.rejects(db.query('select merchant_3d_insights($1,7)',[owner]),{code:'42501'});
});
