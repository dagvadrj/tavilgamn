const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');

test('merchant imports are atomic/idempotent; scoped exports/reports and immutable versioned contract evidence',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`
 create role anon;create role authenticated;create role service_role bypassrls;
 create table profiles(id uuid primary key,role text);
 create table merchant_stores(id text primary key,owner_id uuid unique,active boolean default true,name text,address text,phone text,commission_bps integer default 500);
 create table furniture_models(id uuid primary key,product_id text unique,name text,category text,base_price bigint,in_stock integer,store_ids jsonb,archived_at timestamptz);
 create table orders(id uuid primary key,status text);
 create table merchant_order_fulfillments(order_id uuid,store_id text,created_at timestamptz,status text,delivery_stage text,subtotal bigint,platform_fee bigint,merchant_net bigint,commission_bps integer,items jsonb);
 create table order_payments(order_id uuid,state text);
 create table order_cancellations(order_id uuid,status text);
 create table merchant_wallet_transactions(id uuid primary key,store_id text,kind text,amount bigint,credits bigint,status text,reference text,created_at timestamptz);
 create table merchant_growth_profiles(store_id text,legal_name text);
 grant all on all tables in schema public to service_role;
 -- Existing canonical saver has its own integration suite. This fixture exercises the new batch transaction around it.
 create function save_merchant_product_v2(p_actor uuid,p_data jsonb,p_create boolean,p_model_requested boolean,p_expected_stock integer)
 returns void language plpgsql as $f$
 declare sid text;
 begin
 select id into sid from public.merchant_stores where owner_id=p_actor and active;
 if sid is null then raise exception using errcode='42501';end if;
 if (p_data->>'basePrice')::bigint<0 then raise exception using errcode='22023';end if;
 insert into public.furniture_models values((p_data->>'id')::uuid,p_data->>'id',p_data->>'name',p_data->>'category',(p_data->>'basePrice')::bigint,1,jsonb_build_array(sid),null);
 end $f$;
 create function merchant_wallet_balance(p_store text) returns jsonb language sql as $f$select '{"available":"700","reserved":"100","earned":"800","credits":"3"}'::jsonb$f$;
 `);
 await db.exec(readFileSync('supabase/migrations/20261021113023_merchant_import_reports_contracts.sql','utf8'));
 const owner=randomUUID(),other=randomUUID(),admin=randomUUID(),customer=randomUUID();
 for(const [id,role] of [[owner,'merchant'],[other,'merchant'],[admin,'admin'],[customer,'customer']])await db.query('insert into profiles values($1,$2)',[id,role]);
 await db.query("insert into merchant_stores values('shop',$1,true,'Store','Address','99112233',500),('other',$2,true,'Other','Address','99112233',700)",[owner,other]);
 await db.exec('set role service_role');
 const call=async(q,args=[]) => (await db.query(q,args)).rows[0];
 const batch=(products,key=randomUUID(),hash='a'.repeat(64),actor=owner)=>call('select import_merchant_products($1,$2,$3,$4) data',[actor,key,hash,JSON.stringify(products)]).then(x=>x.data);
 const product=(name,price=100,category='sofa')=>({id:randomUUID(),name,basePrice:price,category,storeIds:['other'],rating:5});
 await assert.rejects(batch([product('Bad')],randomUUID(),'a'.repeat(64),customer),{code:'42501'});
 await assert.rejects(batch([product('First'),product('Invalid',-1)]),{code:'22023'});
 assert.equal((await call('select count(*)::int n from furniture_models')).n,0);
 await assert.rejects(batch([product('Kitchen',100,'kitchen-cabinet')]),{code:'22023'});
 const key=randomUUID(), first=await batch([product('Blue Sofa'),product('Desk',100,'office')],key);
 assert.equal(first.count,2);assert.equal(first.replayed,false);
 assert.equal((await batch([product('Ignored')],key)).replayed,true);
 assert.equal((await batch([product('Ignored')])).replayed,true);
 await assert.rejects(batch([product('Changed')],key,'b'.repeat(64)),{code:'P0003'});
 const own=await db.query("select * from merchant_product_export($1,'sofa','blue',false)",[owner]);
 assert.equal(own.rows.length,1);assert.deepEqual(own.rows[0].store_ids,['shop']);
 assert.equal((await db.query("select * from merchant_product_export($1,'','',false)",[other])).rows.length,0);
 await db.query('update furniture_models set archived_at=now() where id=$1',[own.rows[0].id]);
 assert.equal((await db.query("select * from merchant_product_export($1,'sofa','',false)",[owner])).rows.length,0);
 assert.equal((await db.query("select * from merchant_product_export($1,'sofa','',true)",[owner])).rows.length,1);
 const order1=randomUUID(),order2=randomUUID(),excluded=randomUUID();
 for(const id of [order1,order2,excluded])await db.query("insert into orders values($1,'paid')",[id]);
 for(const [id,at] of [[order1,'2026-10-20T16:00:00Z'],[order2,'2026-10-21T15:59:59Z'],[excluded,'2026-10-21T16:00:00Z']]){
 await db.query("insert into merchant_order_fulfillments values($1,'shop',$2,'paid','completed',1000,70,930,700,'[]')",[id,at]);
 await db.query("insert into order_payments values($1,'paid')",[id]);
 }
 const report=(await call("select merchant_report($1,'2026-10-21','2026-10-21') data",[owner])).data;
 assert.equal(report.orders.length,2);assert.equal(report.orders[0].fee,'70');assert.equal(report.orders[0].commissionBps,700);
 assert.equal((await call("select merchant_report($1,'2026-10-21','2026-10-21') data",[other])).data.orders.length,0);
 await assert.rejects(call("select merchant_report($1,'2025-01-01','2026-10-21')",[owner]),{code:'22023'});
 const adminCall=(action,data={},actor=admin)=>call('select admin_merchant_contracts($1,$2,$3) data',[actor,action,JSON.stringify(data)]).then(x=>x.data);
 const merchantCall=(action='read',data={},actor=owner)=>call('select merchant_contracts($1,$2,$3) data',[actor,action,JSON.stringify(data)]).then(x=>x.data);
 await assert.rejects(adminCall('read',{},owner),{code:'42501'});
 assert.equal((await merchantCall()).current,null);
 const draft=(await adminCall('save',{title:'Agreement',platformName:'Platform LLC',body:'Approved terms'})).versions[0];
 assert.equal((await merchantCall()).current,null);
 await assert.rejects(adminCall('publish',{id:draft.id,revision:999}),{code:'P0003'});
 await adminCall('publish',{id:draft.id,revision:draft.revision});
 await assert.rejects(db.query('update merchant_contract_versions set body=$1 where id=$2',['Changed',draft.id]),{code:'22023'});
 await assert.rejects(merchantCall('accept',{contractId:draft.id,signerName:'Owner',consent:false}),{code:'22023'});
 let accepted=await merchantCall('accept',{contractId:draft.id,signerName:'Owner',consent:true});
 assert.equal(accepted.acceptances.length,1);assert.equal(accepted.acceptances[0].acceptance.commission_bps,500);
 accepted=await merchantCall('accept',{contractId:draft.id,signerName:'Replacement',consent:true});
 assert.equal(accepted.acceptances[0].acceptance.signer_name,'Owner');
 assert.equal((await merchantCall('read',{},other)).acceptances.length,0);
 await assert.rejects(db.query("update merchant_contract_acceptances set signer_name='Forged'"),{code:'42501'});
 const next=(await adminCall('save',{title:'Agreement 2',platformName:'Platform LLC',body:'New terms'})).versions[0];
 await adminCall('publish',{id:next.id,revision:next.revision});
 await assert.rejects(merchantCall('accept',{contractId:draft.id,signerName:'Owner',consent:true}),{code:'P0003'});
 const history=await merchantCall();assert.equal(history.current.id,next.id);assert.equal(history.acceptances[0].contract.body,'Approved terms');
 await db.exec('reset role;set role authenticated');
 await assert.rejects(db.query('select * from merchant_contract_acceptances'),{code:'42501'});
 await assert.rejects(db.query('select merchant_contracts($1)',[owner]),{code:'42501'});
 await assert.rejects(db.query('select merchant_product_export($1)',[owner]),{code:'42501'});
});

