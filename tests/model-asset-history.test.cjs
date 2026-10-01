const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const id='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
function setup(assets,model={processing_status:'ready'}) {
  const filters=[];
  const route=loadSource('src/app/api/models/files/[id]/[...filename]/route.ts',{
    '@/lib/supabase/admin':{getSupabaseAdmin:()=>({from(table){
      const q={select(){return q},eq(k,v){filters.push([table,k,v]);return q},in(k,v){filters.push([table,k,v]);return q},like(k,v){filters.push([table,k,v]);return q},maybeSingle:async()=>({data:model,error:null}),limit:async()=>({data:assets.filter(a=>['delivery','preview','thumbnail'].includes(a.role)&&['available','retired'].includes(a.state)),error:null})};return q;
    }})},
    '@/lib/r2Models':{r2ModelKey:()=>false},
    '@/lib/cloudinaryModels':{cloudinaryModelAsset:()=>true},
  });
  return {route,filters};
}
const get=route=>route.GET(new Request('http://localhost/api/models/files/test/old_model.glb'),{params:Promise.resolve({id,filename:['old_model.glb']})});
test('immutable retired delivery filename still serves after current version changes',async()=>{
  const {route,filters}=setup([{role:'delivery',state:'retired',storage_path:'https://res.cloudinary.com/test/raw/upload/old_model.glb'}]);
  const response=await get(route);assert.equal(response.status,307);
  assert.ok(filters.some(f=>f[1]==='model_id'&&f[2]===id));
  assert.deepEqual(filters.find(f=>f[1]==='role')[2],['delivery','preview','thumbnail']);
  assert.deepEqual(filters.find(f=>f[1]==='state')[2],['available','retired']);
  assert.equal(filters.find(f=>f[0]==='model_assets'&&f[1]==='storage_path')[2],'%/old\\_model.glb');
});
test('source, private export, pending, deleted, ambiguous and nonexistent model history is not public',async()=>{
  for(const asset of [{role:'source',state:'available'},{role:'standard',state:'retired'},{role:'delivery',state:'pending'},{role:'delivery',state:'deleted'}])assert.equal((await get(setup([asset]).route)).status,404);
  assert.equal((await get(setup([{role:'delivery',state:'retired'},{role:'delivery',state:'available'}]).route)).status,404);
  const {route,filters}=setup([],null);assert.equal((await get(route)).status,404);assert.ok(!filters.some(f=>f[0]==='model_assets'));
});
test('raster thumbnails return an image body for the local Next image optimizer',async()=>{
  const originalFetch=global.fetch;
  try {
    global.fetch=async()=>new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'image/png'}});
    const {route}=setup([],{thumbnail_path:'https://res.cloudinary.com/test/image/upload/thumbnail.png'});
    const response=await route.GET(new Request('http://localhost/test'),{params:Promise.resolve({id,filename:['thumbnail.png']})});
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
    assert.deepEqual(Array.from(new Uint8Array(await response.arrayBuffer())),[1,2,3]);
    global.fetch=async()=>new Response('<html>error</html>',{headers:{'content-type':'text/html'}});
    assert.equal((await route.GET(new Request('http://localhost/test'),{params:Promise.resolve({id,filename:['thumbnail.png']})})).status,503);
  } finally {global.fetch=originalFetch;}
});
