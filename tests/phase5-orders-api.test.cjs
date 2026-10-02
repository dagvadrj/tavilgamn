const { test } = require("node:test");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { NextRequest, NextResponse } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");
const id=randomUUID(),actor=randomUUID();
const modules={
  user:"src/app/api/orders/[id]/cancel/route.ts",
  admin:"src/app/api/admin/orders/[id]/cancellation/route.ts",
  platform:"src/app/api/admin/orders/[id]/fulfillment/route.ts",
};
const request=(body,method="POST")=>new NextRequest(`http://localhost/api/orders/${id}/cancel`,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
const params={params:Promise.resolve({id})};
const load=(type,db,authenticated=true)=>loadSource(modules[type],{
  "@/lib/supabase/admin":{getSupabaseAdmin:()=>db},
  "@/lib/supabase/requireUser":{requireUser:async()=>authenticated?{userId:actor,error:null}:{error:NextResponse.json({}, {status:401})}},
  "@/lib/supabase/requireAdmin":{requireAdmin:async()=>authenticated?{userId:actor,error:null}:{error:NextResponse.json({}, {status:403})}},
});
test("Phase 5 cancellation/admin operations cannot run without verified actor",async()=>{
  const db={rpc(){assert.fail("unauthorized requests must not touch commerce data");}};
  assert.equal((await load("user",db,false).POST(request({reason:"not wanted"}),params)).status,401);
  assert.equal((await load("admin",db,false).PATCH(request({action:"approve",note:"verified"},"PATCH"),params)).status,403);
  assert.equal((await load("platform",db,false).PATCH(request({status:"shipped",expectedStatus:"processing"},"PATCH"),params)).status,403);
});
test("customer cancellation binds server actor and order id; strips impersonated identity/status",async()=>{
  let received;
  const route=load("user",{rpc:async(name,args)=>{received={name,args};return {data:{cancellation:{status:"requested"},orderStatus:"paid"},error:null};}});
  const result=await route.POST(request({reason:"  No longer needed  ",userId:"victim",status:"refunded",amount:1}),params);
  assert.equal(result.status,200);
  assert.equal(result.headers.get("cache-control"),"private, no-store");
  assert.deepEqual(received,{name:"request_order_cancellation",args:{p_actor:actor,p_order:id,p_reason:"No longer needed"}});
});
test("approve requires explicit external payment check and refund requires full external verification fields",async()=>{
  const db={rpc(){assert.fail("invalid financial operations must not reach SQL");}};
  const route=load("admin",db);
  for(const payload of [
    {action:"approve",note:"Paid provider state verified"},
    {action:"record_refund",note:"Reference reviewed",reference:"ref-123",amount:100},
    {action:"record_refund",note:"Reference reviewed",reference:"ref-123",amount:-1,externalRefundConfirmed:true},
    {action:"record_refund",note:"Reference reviewed",reference:"x",amount:100,externalRefundConfirmed:true},
    {action:"record_refund",note:"Reference reviewed",reference:"ref-123",amount:1.2,externalRefundConfirmed:true},
  ]) assert.equal((await route.PATCH(request(payload,"PATCH"),params)).status,400);
});
test("refund API records externally completed reference, never invokes a provider",async()=>{
  let received;
  const route=load("admin",{rpc:async(name,args)=>{received={name,args};return {data:{cancellation:{status:"refunded"},orderStatus:"cancelled"},error:null};}});
  const result=await route.PATCH(request({action:"record_refund",note:"Confirmed in bank statement",reference:" REF-123 ",amount:100,externalRefundConfirmed:true,verifiedBy:"victim"},"PATCH"),params);
  assert.equal(result.status,200);
  assert.deepEqual(received,{name:"resolve_order_cancellation",args:{p_actor:actor,p_order:id,p_action:"record_refund",p_note:"Confirmed in bank statement",p_reference:"REF-123",p_amount:100}});
});
test("stale fulfillment/payment state and ownership errors have stable HTTP responses",async()=>{
  for(const [code,status] of [["P0016",409],["42501",403],["P0002",404],["23505",409]]) {
    const route=load("admin",{rpc:async()=>({data:null,error:{code}})});
    const result=await route.PATCH(request({action:"approve",note:"Payment manually checked",externalPaymentChecked:true},"PATCH"),params);
    assert.equal(result.status,status);
    assert.ok((await result.json()).code);
  }
});
test("platform fulfillment binds admin and checks optimistic previous state",async()=>{
  let received;
  const route=load("platform",{rpc:async(name,args)=>{received={name,args};return {error:null};}});
  assert.equal((await route.PATCH(request({status:"shipped",expectedStatus:"processing"},"PATCH"),params)).status,200);
  assert.deepEqual(received,{name:"update_platform_order",args:{p_actor:actor,p_order:id,p_status:"shipped",p_expected_status:"processing"}});
  assert.equal((await route.PATCH(request({status:"cancelled",expectedStatus:"processing"},"PATCH"),params)).status,400);
});
test("stored invoices replay without new provider configuration and still respect cancellation claim",async()=>{
  let remoteCalls=0;
  class ConfigError extends Error {}
  const stored={method:"qpay",state:"ready",instructions:{method:"qpay",url:"https://qpay.example/old"},created_at:new Date().toISOString()};
  const db={from(table){const query={select(){return query;},eq(){return query;},async maybeSingle(){return {data:table==="orders"?{id,total:100,status:"pending_payment"}:{order_id:id},error:null};}};return query;},
    async rpc(){return {data:{claimed:false,payment:stored},error:null};}};
  const route=loadSource("src/app/api/orders/[id]/payment/route.ts",{
    "@/lib/supabase/admin":{getSupabaseAdmin:()=>db},
    "@/lib/supabase/requireUser":{requireUser:async()=>({userId:actor,error:null})},
    "@/lib/payments/providers":{PaymentConfigError:ConfigError,validatePaymentConfig(){throw new ConfigError("temporarily disabled");},createPayment(){remoteCalls++;assert.fail("replay must not create remote invoice");}},
  });
  const result=await route.POST(request({method:"qpay"}),params);
  assert.equal(result.status,200); assert.equal(remoteCalls,0);
  assert.deepEqual((await result.json()).instructions,stored.instructions);
  db.rpc=async()=>({data:null,error:{code:"P0016"}});
  assert.equal((await route.POST(request({method:"qpay"}),params)).status,409);
});
