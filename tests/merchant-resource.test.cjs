const {test}=require('node:test'),assert=require('node:assert/strict'),React=require('react');
const {loadSource}=require('./helpers/load-source.cjs');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('independent resources reveal first response, deduplicate, cache revisits and isolate identities',async t=>{
 let actor='alice',currentKey='';const requests=[],cleanups=[],subscribed=new Set();
 const resource=loadSource('src/features/merchant/useMerchantResource.ts',{
  react:{...React,useCallback:fn=>fn,useEffect(){},useSyncExternalStore(subscribe,snapshot){if(!subscribed.has(currentKey)){subscribed.add(currentKey);cleanups.push(subscribe(()=>{}));}return snapshot();}},
  './merchantApi':{isOwner:owner=>owner===actor,merchantRequest:(path,owner,options)=>new Promise((resolve,reject)=>{requests.push({path,owner,resolve,reject,signal:options.signal});options.signal.addEventListener('abort',()=>reject(Error('Aborted')),{once:true});})},
 });
 t.after(()=>{cleanups.forEach(fn=>fn());resource.clearMerchantResources();});
 const read=path=>{currentKey=actor+path;return resource.useMerchantResource(actor,path);};
 read('/fast');read('/slow');read('/fast');assert.equal(requests.length,2);
 requests[0].resolve({count:7});await flush();assert.equal(read('/fast').data.count,7);assert.equal(read('/slow').loading,true);assert.equal(requests.length,2);
 requests[1].reject(Error('Temporary error'));await flush();assert.equal(read('/fast').data.count,7);assert.equal(read('/slow').error,'Temporary error');
 const before=requests.length;read('/fast');assert.equal(requests.length,before,'cached revisit must not refetch fresh data');
 resource.invalidateMerchantResources('alice');assert.ok(requests.length>before);const late=requests.at(-1);
 actor='bob';resource.clearMerchantResources();assert.equal(late.signal.aborted,true);assert.equal(read('/fast').data,null);late.resolve({count:999});await flush();assert.equal(read('/fast').data,null);requests.at(-1).resolve({count:3});await flush();assert.equal(read('/fast').data.count,3);
});

test('statistics API validates date/page and forwards only the authenticated actor',async()=>{
 const calls=[];let authorized=false;
 const {GET}=loadSource('src/app/api/merchant/dashboard/route.ts',{
 '@/lib/supabase/requireMerchant':{requireMerchant:async()=>authorized?{userId:'verified',error:null}:{error:new Response('{}',{status:401})}},
 '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:{ok:true},error:null};}})},
 });
 const request=query=>({url:'https://example.test/api/merchant/dashboard?'+query});
 assert.equal((await GET(request('section=progress'))).status,401);authorized=true;
 assert.equal((await GET(request('section=progress&date=2026-02-31'))).status,400);
 assert.equal((await GET(request('section=progress&page=-1'))).status,400);
 assert.equal((await GET(request('section=progress&date=2026-10-19&page=1&owner=forged'))).status,200);
 assert.deepEqual(calls,[{name:'merchant_dashboard_progress',args:{p_actor:'verified',p_date:'2026-10-19',p_page:1}}]);
});

test('inventory still starts when a critical statistics request fails',()=>{
 let inventoryEnabled=false;
 const {MerchantOverview}=loadSource('src/features/merchant/MerchantOverview.tsx',{
 react:{...React,useState:initial=>[typeof initial==='function'?initial():initial,()=>{}]},
 '@/features/merchant/useMerchantResource':{useMerchantResource:(_owner,path,enabled)=>{if(path.includes('/products'))inventoryEnabled=enabled;return{data:null,loading:false,error:path.includes('progress')?'failed':null,refresh(){}};}},
 '@/components/MerchantAnalytics':{useMerchantAnalytics:()=>({analytics:null,loading:true,error:null,refresh(){}})},
 });
 MerchantOverview({owner:'owner',store:{id:'store',name:'Store'},onStore(){},onProducts(){}});assert.equal(inventoryEnabled,true);
});
