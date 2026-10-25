const {test}=require('node:test'),assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
test('admin trends require authorization and keep large monetary amounts exact',async()=>{
 let authorized=false,reads=0;
 const now=new Date();
 const rows=[{id:'order',created_at:now.toISOString(),merchant_order_fulfillments:[{subtotal:'9007199254740993',platform_fee:'1000'},{subtotal:'7',platform_fee:'1'}]}];
 const query={select(){return this},eq(){return this},gte(){return this},lte(){return this},order(){return this},range:async()=>{reads++;return{data:rows,error:null}}};
 const {GET}=loadSource('src/app/api/admin/trends/route.ts',{
  '@/lib/supabase/requireAdmin':{requireAdmin:async()=>authorized?{userId:'admin'}:{error:new Response('',{status:401})}},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({from:()=>query})},
 });
 assert.equal((await GET({})).status,401);assert.equal(reads,0);authorized=true;
 const result=await GET({});assert.equal(result.status,200);const data=await result.json();
 assert.equal(data.series.length,90);assert.equal(data.series.at(-1).gross,'9007199254741000');assert.equal(data.series.at(-1).net,'1001');assert.equal(data.series.at(-1).orders,'1');assert.equal(data.series[0].gross,'0');
});
test('concurrent imperative reads deduplicate and invalidation discards old responses',async()=>{
 let actor='alice';const requests=[];
 const resource=loadSource('src/features/merchant/useMerchantResource.ts',{
  './merchantApi':{isOwner:owner=>owner===actor,merchantRequest:()=>new Promise(resolve=>requests.push(resolve))},
 });
 const a=resource.readMerchantResource('alice','/a'),b=resource.readMerchantResource('alice','/a');assert.equal(requests.length,1);
 resource.invalidateMerchantResources('alice');const c=resource.readMerchantResource('alice','/a');assert.equal(requests.length,2);
 requests[0]({revision:1});requests[1]({revision:2});assert.deepEqual(await Promise.all([a,b,c]),[{revision:2},{revision:2},{revision:2}]);
 actor='bob';await assert.rejects(resource.readMerchantResource('alice','/a'),/Нэвтрэлт/);resource.clearMerchantResources();
});
