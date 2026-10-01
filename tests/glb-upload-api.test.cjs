const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { loadSource } = require('./helpers/load-source.cjs');
const { fixture } = require('./helpers/glb-fixture.cjs');
const modelId='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', actor='11111111-2222-4333-8444-555555555555', version='dddddddd-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const sourcePath=`r2://test-bucket/models/${modelId}/source/${version}.glb`;
for (const key of ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY']) process.env[key]='test-only';
process.env.R2_BUCKET_NAME='test-bucket';
const request=body=>new Request('http://localhost/api/admin/models/upload-complete',{method:'POST',body:JSON.stringify({modelId,sourcePath,frontConfirmed:true,...body})});
function setup(options={}) {
  const bytes=Buffer.from(options.bytes??fixture()); let sends=0,queued=0,lastArgs;
  const model={id:modelId,category:'kitchen-cabinet',dimensions_w:.7,dimensions_h:.84,dimensions_d:.6,archived_at:null,cabinet_module_id:version,...options.model};
  const intent=options.intent===null?null:{id:version,byte_size:bytes.length,state:'pending',version_id:version,...options.intent};
  const db={from(table) { const q={select(){return q},eq(){return q},async maybeSingle(){return {data:table==='model_assets'?intent:model,error:null}}}; return q; },async rpc(name,args) {assert.equal(name,'queue_model_asset');queued++;lastArgs=args;return {data:version,error:null}}};
  class Command { constructor(input){this.input=input} }
  class Head extends Command {} class Get extends Command {}
  const route=loadSource('src/app/api/admin/models/upload-complete/route.ts',{
    '@/lib/supabase/requireAdmin':{requireAdmin:async()=>options.denied?{error:new Response(null,{status:401})}:{userId:actor,error:null}},
    '@/lib/supabase/admin':{getSupabaseAdmin:()=>db},
    '@aws-sdk/client-s3':{HeadObjectCommand:Head,GetObjectCommand:Get,S3Client:class { async send(command){sends++;if(command instanceof Head)return {ContentLength:options.headSize??bytes.length,ETag:'etag'};assert.equal(command.input.IfMatch,'etag');return {Body:{transformToByteArray:async()=>bytes}}} destroy(){} }},
  });
  return {route,stats:()=>({sends,queued,lastArgs,bytes})};
}
test('upload-complete validates downloaded GLB and queues checksum atomically',async()=>{
  const {route,stats}=setup(); const response=await route.POST(request());
  assert.equal(response.status,200);assert.equal((await response.json()).status,'queued');
  const s=stats();assert.equal(s.sends,2);assert.equal(s.queued,1);assert.equal(s.lastArgs.p_actor,actor);
  assert.equal(s.lastArgs.p_sha256,createHash('sha256').update(s.bytes).digest('hex'));
  assert.equal(s.lastArgs.p_validation.frontConfirmed,true);
});
test('upload-complete rejects missing actor-owned intent, archive, and missing front confirmation before R2 access',async()=>{
  for (const [options,body,status] of [[{intent:null},{},400],[{model:{archived_at:'2026-10-01'}},{},404],[{},{frontConfirmed:false},400],[{denied:true},{},401]]) {
    const {route,stats}=setup(options);assert.equal((await route.POST(request(body))).status,status);assert.equal(stats().sends,0);assert.equal(stats().queued,0);
  }
});
test('upload-complete refuses forged size, origin, transforms, dimensions, and missing kitchen module',async()=>{
  for (const options of [{headSize:10},{bytes:fixture(d=>d.nodes[0].translation=[0,-.1,0])},{model:{dimensions_h:.74}},{model:{dimensions_d:.635}},{model:{cabinet_module_id:null}}]) {
    const {route,stats}=setup(options);assert.equal((await route.POST(request())).status,400);assert.equal(stats().queued,0);
  }
});
test('accepted upload replay does not requeue or fetch source again',async()=>{
  const {route,stats}=setup({intent:{state:'available'}});const response=await route.POST(request());
  assert.equal(response.status,200);assert.equal((await response.json()).status,'accepted');assert.equal(stats().sends,0);assert.equal(stats().queued,0);
});
test('front handle projection is explicit, bounded, kitchen-only and saved in validation',async()=>{
  const bytes=fixture((d,b)=>{for(let i=8;i<b.length;i+=12)b.writeFloatLE(b.readFloatLE(i)*635.1/598,i)});
  const {route,stats}=setup({bytes});assert.equal((await route.POST(request({frontProjectionMm:35.1}))).status,200);
  assert.equal(stats().lastArgs.p_validation.frontProjectionMm,35.1);
  for(const options of [{},{model:{category:'sofa'}}])for(const projection of [101,-1,'35',35]) {
    if(!options.model&&projection===35)continue;
    const check=setup(options);assert.equal((await check.route.POST(request({frontProjectionMm:projection}))).status,400);assert.equal(check.stats().queued,0);
  }
});
test('archive and restore APIs are actor-bound and never physically delete models',async()=>{
  const calls=[];const route=loadSource('src/app/api/models/[id]/route.ts',{
    '@/lib/supabase/requireAdmin':{requireAdmin:async()=>({userId:actor,error:null})},
    '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return {error:null}}})},
  });
  const params={params:Promise.resolve({id:modelId})};
  assert.equal((await route.DELETE(request(),params)).status,200);assert.equal((await route.PATCH(request(),params)).status,200);
  assert.deepEqual(calls.map(c=>c.args.p_archived),[true,false]);assert.ok(calls.every(c=>c.name==='set_model_archived'&&c.args.p_actor===actor));
});
