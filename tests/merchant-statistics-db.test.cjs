const {test}=require('node:test'),assert=require('node:assert/strict'),{PGlite}=require('@electric-sql/pglite'),{readFileSync}=require('node:fs');
test('dashboard statistics are scoped, payment-verified, date-correct and bounded',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table profiles(id uuid primary key,role text);create table merchant_stores(id text,owner_id uuid,active boolean);
 create table orders(id uuid primary key,status text,delivery jsonb);
 create table merchant_order_fulfillments(order_id uuid,store_id text,owner_id uuid,delivery_stage text,created_at timestamptz,updated_at timestamptz,items jsonb,subtotal bigint,merchant_net bigint);
 create table order_cancellations(order_id uuid,status text);create table order_payments(order_id uuid,state text);
 create function merchant_delivery_store(actor uuid) returns text language plpgsql as $$declare result text;begin select s.id into result from public.merchant_stores s join public.profiles p on p.id=s.owner_id where s.owner_id=actor and p.role='merchant' and s.active;if result is null then raise insufficient_privilege;end if;return result;end$$;
 insert into profiles values('11111111-1111-4111-8111-111111111111','merchant'),('22222222-2222-4222-8222-222222222222','merchant');
 insert into merchant_stores values('alice','11111111-1111-4111-8111-111111111111',true),('bob','22222222-2222-4222-8222-222222222222',true);`);
 await db.exec(readFileSync('supabase/migrations/20261018171950_merchant_dashboard_statistics.sql','utf8'));
 const actor='11111111-1111-4111-8111-111111111111';
 for(let i=1;i<=25;i++){
  const id=`aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12,'0')}`;
  await db.query(`insert into orders values($1,$2,'{"name":"Customer","address":"secret-address"}');`,[id,i===1?'pending_payment':i===2?'cancelled':'paid']);
  await db.query(`insert into merchant_order_fulfillments values($1,$2,$3,$4,$5,now(),'[{"name":"Chair"}]',100,95)`,[id,i===3?'bob':'alice',i===3?'22222222-2222-4222-8222-222222222222':actor,i%2?'incoming':'delivered',i===4?'2026-10-18T15:59:59Z':'2026-10-18T16:00:00Z']);
  if(i!==1)await db.query('insert into order_payments values($1,\'paid\')',[id]);
 }
 const read=async(page=0)=>(await db.query(`select merchant_dashboard_progress($1,'2026-10-19',$2) data`,[actor,page])).rows[0].data;
 const data=await read();assert.equal(data.total,22);assert.equal(data.dayTotals.orders,22);assert.equal(data.dayTotals.paidOrders,21);assert.equal(data.dayTotals.gross,'2100');assert.equal(data.dayTotals.net,'1995');assert.equal(data.orders.length,20);assert.equal(data.hasMore,true);assert.equal((await read(1)).orders.length,2);assert.equal(data.orders[0].progress,80);assert.equal(data.orders.at(-1).progress,0);assert.equal(data.dates.length,14);assert.equal(data.dates[0].date,'2026-10-19');assert.equal(data.dates[1].count,1);assert.ok(!JSON.stringify(data).includes('secret-address'));
 await assert.rejects(db.query(`select merchant_dashboard_progress('33333333-3333-4333-8333-333333333333')`),{code:'42501'});
 const acl=(await db.query(`select has_function_privilege('anon','merchant_dashboard_progress(uuid,date,integer)','execute') a,has_function_privilege('authenticated','merchant_dashboard_trends(uuid)','execute') b`)).rows[0];assert.equal(acl.a,false);assert.equal(acl.b,false);
 const trends=(await db.query('select merchant_dashboard_trends($1) data',[actor])).rows[0].data;assert.equal(trends.months.length,6);assert.ok(trends.months.every(m=>typeof m.net==='string'));
});
