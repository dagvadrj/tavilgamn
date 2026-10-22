const test=require('node:test'),assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
function storage(t){const old={window:global.window,localStorage:global.localStorage};const local=new Map(),session=new Map();const wrap=m=>({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)});global.localStorage=wrap(local);global.window={localStorage:global.localStorage,sessionStorage:wrap(session)};t.after(()=>{global.window=old.window;global.localStorage=old.localStorage});return {local,session};}
test('explicit room sign-in carries only the active guest project and preserves existing account projects',t=>{
 const {session}=storage(t);const {useDesigns:s,setDesignOwner,prepareRoomAuthReturn}=loadSource('src/store/designs.ts');
 setDesignOwner('account');s.getState().createNew('40','Existing account room');s.getState().saveCurrent();const existing=s.getState().current.id;
 setDesignOwner(null);s.getState().createNew('40','Other guest room');s.getState().saveCurrent();const other=s.getState().current.id;
 s.getState().createNew('80','Guest project');s.getState().addRoom('office');s.getState().beginEdit();s.getState().updateRoom({wallColor:'#abc123'});const guestId=s.getState().current.id;
 const next=prepareRoomAuthReturn(),id=new URL(next,'https://test').searchParams.get('design');assert.notEqual(id,guestId);assert.ok(session.has('casa-room-auth-handoff'));
 const auth=loadSource('src/lib/authRedirect.ts');assert.equal(auth.authDestination('?next='+encodeURIComponent(next)),next);
 setDesignOwner('account');assert.equal(s.getState().current.id,id);assert.equal(s.getState().current.name,'Guest project');assert.equal(s.getState().current.wallColor,'#abc123');assert.equal(s.getState().current.rooms.length,2);assert.ok(s.getState().designs.some(d=>d.id===existing));assert.ok(!s.getState().designs.some(d=>d.id===other));assert.equal(session.size,0);
 const restored=loadSource('src/store/designs.ts');restored.setDesignOwner('account');assert.equal(restored.useDesigns.getState().current.id,id);
 setDesignOwner('another');assert.equal(s.getState().current,null);setDesignOwner(null);assert.equal(s.getState().current.id,guestId);
});
test('guest projects are never imported implicitly and expired or corrupt handoffs are ignored',t=>{
 const {session}=storage(t);const {useDesigns:s,setDesignOwner}=loadSource('src/store/designs.ts');s.getState().createNew('40','Private guest');s.getState().saveCurrent();const design=s.getState().current;
 setDesignOwner('account');assert.equal(s.getState().current,null);setDesignOwner(null);
 session.set('casa-room-auth-handoff',JSON.stringify({source:'guest',createdAt:Date.now()-86400001,design}));setDesignOwner('second');assert.equal(s.getState().current,null);
 session.set('casa-room-auth-handoff','{bad');setDesignOwner('third');assert.equal(s.getState().current,null);
});
test('room login preparation fails visibly when draft storage cannot be written',t=>{
 storage(t);const {useDesigns:s,prepareRoomAuthReturn}=loadSource('src/store/designs.ts');s.getState().createNew('40','Keep this draft');global.window.sessionStorage.setItem=()=>{throw Error('Storage full')};assert.throws(prepareRoomAuthReturn,/Storage full/);assert.equal(s.getState().current.name,'Keep this draft');
});
test('saved room and library return routes reject unknown or repeated parameters',()=>{
 const auth=loadSource('src/lib/authRedirect.ts'),id='33333333-3333-4333-8333-333333333333';
 for(const next of ['/planner',`/planner?design=d_${id}`,`/planner?design=d_${id}&library=mine`,'/planner?library=mine',`/planner?kitchen=${id}&setup=1`,`/planner?product=${id}&source=showroom`])assert.equal(auth.safeAuthDestination(next),next);
 for(const next of ['/planner?design=other','/planner?design=bad&design=bad','/planner?next=https://evil.test','/planner?library=other','/planner/../admin'])assert.equal(auth.safeAuthDestination(next),null);
});
test('storefront login keeps product selection, catalog search and valid current-page paths',()=>{
 const {shopLoginHref}=loadSource('src/lib/shopAuthReturn.ts',{'@/store/cart':{requestGuestCartTransfer(){}},'@/store/wishlist':{requestGuestWishlistTransfer(){}}});
 for(const [path,query]of [['/product/sofa','?color=oak&view=3d'],['/catalog','?q=Luna&sort=price-asc'],['/wishlist',''],['/cart',''],['/stores','?type=factory'],['/catalog/stores/33333333-3333-4333-8333-333333333333','']])assert.equal(new URL(shopLoginHref(path,query),'https://test').searchParams.get('next'),path+query);
 assert.equal(new URL(shopLoginHref('/catalog','?next=https://evil.test'),'https://test').searchParams.get('next'),'/catalog');
});
test('wishlist transfer is opt-in, merges by product and is consumed once',t=>{
 const {session}=storage(t);const {useWishlist:s,setWishlistOwner,requestGuestWishlistTransfer}=loadSource('src/store/wishlist.ts');
 setWishlistOwner('account');s.getState().toggle('owned');setWishlistOwner(null);s.getState().toggle('guest');requestGuestWishlistTransfer();setWishlistOwner('account');assert.deepEqual(s.getState().items.map(x=>x.productId),['owned','guest']);assert.equal(session.size,0);setWishlistOwner('another');assert.equal(s.getState().items.length,0);
});
