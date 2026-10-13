const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NextRequest,NextResponse}=require('next/server');
const {loadSource}=require('./helpers/load-source.cjs');
const id='12345678-1234-4234-8234-123456789abc';

test('admin kitchen detail blocks nonadmins before reading private designs',async()=>{
 let reads=0;
 const route=loadSource('src/app/api/admin/kitchen-designs/route.ts',{
  '@/lib/supabase/requireAdmin':{requireAdmin:async()=>({error:NextResponse.json({error:'Forbidden'},{status:403})})},
  '@/lib/kitchenMarketplaceServer':{readAdminKitchenDesigns:async()=>{reads++;return[]}},
 });
 const result=await route.GET(new NextRequest(`http://localhost/api/admin/kitchen-designs?design=${id}`));
 assert.equal(result.status,403);assert.equal(reads,0);
});

test('admin kitchen detail validates IDs and distinguishes missing designs from the list',async()=>{
 const reads=[];
 const route=loadSource('src/app/api/admin/kitchen-designs/route.ts',{
  '@/lib/supabase/requireAdmin':{requireAdmin:async()=>({userId:'verified-admin'})},
  '@/lib/kitchenMarketplaceServer':{readAdminKitchenDesigns:async(db,designId)=>{reads.push(designId);return[]}},
  '@/lib/kitchenRenderConfig':{configuredKitchenRender:()=>({provider:'cloudflare',model:'flux'}),kitchenRenderConfigured:()=>true},
 });
 const get=query=>route.GET(new NextRequest('http://localhost/api/admin/kitchen-designs'+query));
 assert.equal((await get('?design=invalid')).status,400);assert.equal(reads.length,0);
 const missing=await get(`?design=${id}`);assert.equal(missing.status,404);assert.match(missing.headers.get('Cache-Control'),/no-store/);assert.deepEqual(reads,[id]);
 const list=await get('');assert.equal(list.status,200);assert.deepEqual(await list.json(),{designs:[],renderConfig:{provider:'cloudflare',model:'flux',ready:true}});assert.equal(reads[1],undefined);
});

test('admin detail reads the requested ID before the list limit so older designs remain reachable',async()=>{
 const calls=[];
 const query={select(){return this},order(){return this},limit(){return this},eq(column,value){calls.push([column,value]);return this},then(resolve){resolve({data:[],error:null})}};
 const db={from(table){assert.equal(table,'kitchen_designs');return query}};
 const {readAdminKitchenDesigns}=loadSource('src/lib/kitchenMarketplaceServer.ts',{'@/lib/supabase/admin':{getSupabaseAdmin:()=>db}});
 assert.deepEqual(await readAdminKitchenDesigns(db,id),[]);assert.deepEqual(calls,[['id',id]]);
});
