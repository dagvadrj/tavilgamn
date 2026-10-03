const {test}=require('node:test');const assert=require('node:assert/strict');const {loadSource}=require('./helpers/load-source.cjs');
const {randomUUID}=require('node:crypto');
const {roomDocument}=loadSource('src/lib/roomProjectValidation.ts');
const design=()=>({id:'d_local',name:'Room',size:'40',width:5,depth:4,wallColor:'#EFE6D6',floorColor:'#C9A37A',pieces:[],createdAt:1,updatedAt:1});
class ProjectRequestError extends Error{constructor(message,status){super(message);this.status=status;}}
test('room client coalesces duplicate saves, retries acknowledged operation IDs and rejects stale owner responses',async()=>{
  const calls=[];let resolve;
  const api=loadSource('src/store/roomProjects.ts',{'@/lib/plannerProjectRequest':{ProjectRequestError,plannerProjectRequest:async(owner,url,init)=>{calls.push({owner,url,body:init?.body?JSON.parse(init.body):null});return new Promise(r=>{resolve=r;});}}});
  const a=randomUUID(),b=randomUUID(),id=randomUUID(),doc=roomDocument(design());api.setRoomProjectOwner(a);
  const first=api.useRoomProjects.getState().save(id,'Room',doc,0);const second=api.useRoomProjects.getState().save(id,'Room',doc,0);
  assert.equal(first,second);assert.equal(calls.length,1);
  api.setRoomProjectOwner(b);resolve({project:{id,name:'Room',document:doc,revision:1,room_count:1,piece_count:0,created_at:'now',updated_at:'now'}});
  assert.equal(await first,null);assert.deepEqual(api.useRoomProjects.getState().items,[]);assert.equal(api.useRoomProjects.getState().owner,b);
  let attempts=0;const keys=[],documents=[];
  const retry=loadSource('src/store/roomProjects.ts',{'@/lib/plannerProjectRequest':{ProjectRequestError,plannerProjectRequest:async(owner,url,init)=>{
    keys.push(JSON.parse(init.body).operationId);documents.push(JSON.parse(init.body).document);if(!attempts++)throw new ProjectRequestError('Lost acknowledgement',503);
    return {project:{id,name:'Room',document:doc,revision:1,room_count:1,piece_count:0,created_at:'now',updated_at:'now'}};
  }}});retry.setRoomProjectOwner(a);
  assert.equal(await retry.useRoomProjects.getState().save(id,'Room',doc,0),null);
  const later=structuredClone(doc);later.design.updatedAt++;
  assert.equal((await retry.useRoomProjects.getState().save(id,'Room',later,0)).revision,1);assert.equal(keys[0],keys[1]);
  assert.deepEqual(documents[0],documents[1],'retry sends the exact acknowledged snapshot despite local bookkeeping changes');
});
test('local unknown schema and quota failure never overwrite the original; account switch separates cloud links and drafts',()=>{
  const beforeWindow=global.window, beforeStorage=global.localStorage;
  const raw=JSON.stringify({state:{schemaVersion:99,designs:[{future:'draft'}]},version:0}),data=new Map([['casa-designs-guest',raw]]);
  global.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};global.window={localStorage:global.localStorage};
  try{
    const api=loadSource('src/store/designs.ts');api.useDesigns.getState().createNew('40');api.useDesigns.getState().saveCurrent();
    assert.equal(data.get('casa-designs-guest'),raw);
    api.setDesignOwner('other-account');assert.equal(api.useDesigns.getState().current,null);assert.deepEqual(api.useDesigns.getState().cloudLinks,{});
    global.localStorage.setItem=()=>{throw new Error('Quota exceeded');};
    api.useDesigns.getState().createNew('40');assert.ok(api.useDesigns.getState().current,'memory draft survives a failed write');
  }finally{global.window=beforeWindow;global.localStorage=beforeStorage;}
});
test('planner login return keeps only safe project identifiers, rejecting open redirects and arbitrary query injection',()=>{
  const {authDestination}=loadSource('src/lib/authRedirect.ts'),id=randomUUID();
  assert.equal(authDestination('?next='+encodeURIComponent(`/planner?project=${id}`)),`/planner?project=${id}`);
  assert.equal(authDestination('?next='+encodeURIComponent(`/kitchen?design=${id}&redirect=https://evil.test`)),`/kitchen?design=${id}`);
  for(const value of ['//evil.test','/planner/../admin','/planner\\evil','https://evil.test','/planner#//evil'])assert.equal(authDestination('?next='+encodeURIComponent(value)),'/account');
});
test('reload keeps an independent dirty recovery copy after the reopened cloud project is saved again',()=>{
  const api=loadSource('src/store/designs.ts'),doc=roomDocument(design()),project={id:randomUUID(),name:'Room',document:doc,revision:1};
  api.useDesigns.getState().openCloud(project);
  api.useDesigns.getState().updateRoom({width:7});
  api.useDesigns.getState().openCloud({...project,revision:2});
  api.useDesigns.getState().saveCurrent();
  const recovery=api.useDesigns.getState().designs.find(d=>d.id!==doc.design.id);
  assert.equal(recovery.width,7);assert.equal(api.useDesigns.getState().current.width,5);
  assert.equal(api.useDesigns.getState().cloudLinks[recovery.id],undefined,'recovery can be explicitly imported as its own project');
});
test('duplicate auth events do not fail sign-in; delayed profile reads cannot resurrect a signed-out owner',async t=>{
  const previous=global.window;t.after(()=>{global.window=previous;});global.window={setTimeout:fn=>fn()};
  let listener;const profiles=[];const user={id:randomUUID(),email:'fixture@example.test',user_metadata:{},created_at:new Date().toISOString()};
  const sdk={auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:fn=>{listener=fn;},signInWithPassword:async()=>({data:{user},error:null}),signOut:async()=>({})},
    from:()=>({select:()=>({eq:()=>({maybeSingle:()=>new Promise(resolve=>profiles.push(resolve))})})})};
  const ownerCalls=[],owner=name=>id=>ownerCalls.push([name,id]);
  const auth=loadSource('src/store/auth.ts',{'@/lib/supabase/client':{supabase:sdk,isSupabaseConfigured:true},
    '@/store/cart':{setCartOwner:owner('cart')},'@/store/wishlist':{setWishlistOwner:owner('wishlist')},
    '@/store/designs':{setDesignOwner:owner('room')},'@/store/kitchens':{setKitchenOwner:owner('kitchen')},'@/store/roomProjects':{setRoomProjectOwner:owner('cloudRoom')}}).useAuth;
  await auth.getState().initialize();const signIn=auth.getState().signIn('fixture@example.test','password');
  await new Promise(r=>setImmediate(r));listener('SIGNED_IN',{user});
  profiles[0]({data:{role:'customer'}});assert.equal((await signIn).error,null);
  await auth.getState().signOut();profiles[1]({data:{role:'customer'}});await new Promise(r=>setImmediate(r));
  assert.equal(auth.getState().user,null);assert.deepEqual(ownerCalls.at(-1),['cloudRoom',null]);
});
