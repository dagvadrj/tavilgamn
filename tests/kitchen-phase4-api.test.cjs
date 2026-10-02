const {test}=require('node:test');
const assert=require('node:assert/strict');
const {NextRequest}=require('next/server');
const {loadSource}=require('./helpers/load-source.cjs');
const marketplace=loadSource('src/lib/kitchenMarketplace.ts');
const id='12345678-1234-4234-8234-123456789abc';
const actor='22345678-1234-4234-8234-123456789abc';

test('quote 2D plan owns its styles and exposes a genuinely read-only measured snapshot',()=>{
  const React=require('react'); const {renderToStaticMarkup}=require('react-dom/server');
  const {Plan}=loadSource('src/features/kitchen-planner/components/PlannerPanels.tsx',{'./kitchen-plan.css':{}});
  const {createUnifiedKitchen}=loadSource('src/lib/kitchenAssembly.ts');
  const kitchen=createUnifiedKitchen(); kitchen.room.width=4200;
  const html=renderToStaticMarkup(React.createElement(Plan,{kitchen,selectedId:null,onSelect:()=>{},readOnly:true}));
  assert.match(html,/4200 мм/); assert.match(html,/km-plan is-read-only/); assert.doesNotMatch(html,/role="button"|tabindex=/);
  const {readFileSync}=require('node:fs');
  assert.match(readFileSync('src/features/kitchen-planner/components/kitchen-plan.css','utf8'),/\.km-room-outline\s*\{\s*fill: #efede5/);
});

test('normal merchant navigation clears stale quote focus while notification parsing keeps its target tab',()=>{
  const navigation=loadSource('src/lib/merchantNavigation.ts');
  assert.equal(navigation.merchantLocationPath('/merchant',`?tab=quotes&quote=${id}`,'','kitchens'),'/merchant?tab=kitchens');
  assert.deepEqual(navigation.readMerchantLocation(`?tab=quotes&quote=${id}`),{tab:'quotes',designId:null});
});

test('Phase 4 listing validation supports price ranges/materials and seven canonical states',()=>{
  const details={versionId:id,mode:'sync_project',title:'Oak kitchen',pricingMode:'from',priceFrom:1000,priceTo:2000,materials:['Oak','MDF']};
  assert.deepEqual(marketplace.parseKitchenMarketplaceVersion(details).payload.materials,['Oak','MDF']);
  for(const change of [{priceTo:999},{pricingMode:'fixed'},{materials:['Oak','Oak']}])
    assert.throws(()=>marketplace.parseKitchenMarketplaceVersion({...details,...change}),marketplace.KitchenMarketplaceInputError);
  assert.equal(marketplace.kitchenLifecycle({publicationStatus:'draft',reviewStatus:'rejected'}),'changes_requested');
  assert.equal(marketplace.kitchenLifecycle({publicationStatus:'published',reviewStatus:'draft'}),'published');
  assert.equal(marketplace.readKitchenReview({designId:id,versionId:id,action:'published'}).action,'published');
  assert.throws(()=>marketplace.readKitchenReview({designId:id,action:'suspended',note:''}));
  assert.equal(marketplace.readKitchenReview({designId:id,action:'suspended',note:'Policy issue'}).versionId,null);
});

test('AI merchant API requires consent, uses verified actor and reports quota as 429',async()=>{
  const calls=[];
  const route=loadSource('src/app/api/merchant/kitchen-designs/[id]/renders/route.ts',{
    '@/lib/supabase/requireMerchant':{requireMerchant:async()=>({userId:actor})},
    '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push([name,args]);return {data:null,error:{code:'P0019'}};}})},
  });
  const request=body=>new NextRequest(`http://localhost/api/merchant/kitchen-designs/${id}/renders`,{method:'POST',body:JSON.stringify(body)});
  const body={versionId:id,sourceMediaId:actor,direction:'Daylight',actor:id};
  assert.equal((await route.POST(request(body),{params:Promise.resolve({id})})).status,400);
  assert.equal(calls.length,0);
  assert.equal((await route.POST(request({...body,consent:true}),{params:Promise.resolve({id})})).status,429);
  assert.equal(calls[0][1].p_actor,actor); assert.equal(calls[0][1].p_consent,true);
});

test('AI admin API cannot call a provider without explicit cost approval',async()=>{
  const route=loadSource('src/app/api/admin/kitchen-render-jobs/[id]/generate/route.ts',{
    '@/lib/supabase/requireAdmin':{requireAdmin:async()=>({userId:actor})},
    '@/lib/supabase/admin':{getSupabaseAdmin:()=>{throw new Error('No job must be claimed');}},
  });
  const result=await route.POST(new NextRequest(`http://localhost/api/admin/kitchen-render-jobs/${id}/generate`,{method:'POST',body:'{}'}),{params:Promise.resolve({id})});
  assert.equal(result.status,400);
});

test('merchant quote preview scopes immutable project to verified owner and active store',async()=>{
  const calls=[];
  const db={from(table){const chain={select:()=>chain,eq:(...args)=>{calls.push([table,...args]);return chain;},in:()=>chain,
    maybeSingle:async()=>({data:table==='merchant_stores'?{id:'factory'}:null,error:null})};return chain;}};
  const route=loadSource('src/app/api/merchant/kitchen-quotes/[id]/project/route.ts',{
    '@/lib/supabase/requireMerchant':{requireMerchant:async()=>({userId:actor})},
    '@/lib/supabase/admin':{getSupabaseAdmin:()=>db},
  });
  const result=await route.GET(new NextRequest(`http://localhost/api/merchant/kitchen-quotes/${id}/project`),{params:Promise.resolve({id})});
  assert.equal(result.status,404);
  assert.ok(calls.some(([table,key,value])=>table==='kitchen_quote_requests'&&key==='merchant_owner_id'&&value===actor));
  assert.ok(calls.some(([table,key,value])=>table==='kitchen_quote_requests'&&key==='store_id'&&value==='factory'));
  assert.equal(result.headers.get('Cache-Control'),'private, no-store');
});

test('quote notifications accept only local links, not protocol-relative or backslash destinations',()=>{
  const {merchantNotificationFromRow}=loadSource('src/lib/merchantNotifications.ts');
  for(const href of ['//evil.example','/\\evil.example','https://evil.example']) assert.equal(merchantNotificationFromRow({id,href}).href,'/account');
  assert.equal(merchantNotificationFromRow({id,href:`/merchant?tab=quotes&quote=${id}`}).href,`/merchant?tab=quotes&quote=${id}`);
});
