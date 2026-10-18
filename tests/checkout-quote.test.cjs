const test=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {loadSource}=require('./helpers/load-source.cjs');

function harness() {
  const slots=[];let cursor=0,pending=[],dirty=false;
  const state=initial=>{const at=cursor++;if(!slots[at]){slots[at]={value:initial};slots[at].set=value=>{slots[at].value=typeof value==='function'?value(slots[at].value):value;dirty=true;};}return [slots[at].value,slots[at].set];};
  const effect=(fn,deps)=>{const at=cursor++,old=slots[at];if(!old||deps.some((value,i)=>!Object.is(value,old.deps[i]))){slots[at]={deps};pending.push(()=>{old?.cleanup?.();slots[at].cleanup=fn();});}};
  const requests=[];
  const {useCheckoutQuote}=loadSource('src/components/useCheckoutQuote.ts',{
    react:{...React,useState:state,useEffect:effect,useCallback:fn=>fn},
    '@/lib/authFetch':{authFetch:(url,options,userId)=>new Promise((resolve,reject)=>requests.push({url,options,userId,resolve,reject}))},
  });
  return {requests,render(userId,signature){let result;for(let i=0;i<5;i++){cursor=0;pending=[];dirty=false;result=useCheckoutQuote(userId,signature);pending.forEach(fn=>fn());if(!dirty)return result;}throw Error('Unstable hook');},dispose(){slots.forEach(slot=>slot.cleanup?.());}};
}
const cart=n=>JSON.stringify([{productId:'chair',color:'oak',material:'wood',qty:n}]);
const quote=total=>({items:[],subtotal:total,shipping:0,total});
const respond=async(request,total,status=200)=>{request.resolve(new Response(JSON.stringify(status===200?quote(total):{error:'Price unavailable'}),{status}));await new Promise(resolve=>setImmediate(resolve));};

test('checkout checks price automatically before any address input, without creating an order',async()=>{
  const h=harness();let state=h.render('user-a',cart(1));
  assert.equal(state.loading,true);assert.equal(state.quote,null);assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].url,'/api/orders/quote');assert.equal(h.requests[0].userId,'user-a');
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{items:JSON.parse(cart(1))});
  await respond(h.requests[0],100);state=h.render('user-a',cart(1));assert.equal(state.quote.total,100);assert.equal(state.loading,false);
  h.render('user-a',cart(1));assert.equal(h.requests.length,1);h.dispose();
});

test('cart changes discard delayed old quotes even when a fetch ignores abort',async()=>{
  const h=harness();h.render('user-a',cart(1));const first=h.requests[0];
  const next=h.render('user-a',cart(2));assert.equal(next.quote,null);assert.equal(first.options.signal.aborted,true);
  await respond(h.requests[1],200);await respond(first,100);
  assert.equal(h.render('user-a',cart(2)).quote.total,200);h.dispose();
});

test('quotes cannot leak across accounts or survive an empty cart',async()=>{
  const h=harness();h.render('user-a',cart(1));await respond(h.requests[0],100);
  assert.equal(h.render(undefined,cart(1)).quote,null);assert.equal(h.requests[0].options.signal.aborted,true);
  assert.equal(h.render('user-b',cart(1)).quote,null);assert.equal(h.requests[1].userId,'user-b');
  h.render('user-b','[]');await respond(h.requests[1],200);const empty=h.render('user-b','[]');
  assert.equal(empty.quote,null);assert.equal(empty.loading,false);assert.equal(h.requests.length,2);h.dispose();
});

test('failed quotes can be retried without submitting delivery data; changed prices remain visible for confirmation',async()=>{
  const h=harness();h.render('user-a',cart(1));await respond(h.requests[0],0,503);
  let state=h.render('user-a',cart(1));assert.equal(state.error,'Price unavailable');assert.equal(state.quote,null);assert.equal(state.loading,false);
  state.retryQuote();state=h.render('user-a',cart(1));assert.equal(state.loading,true);await respond(h.requests[1],100);
  state=h.render('user-a',cart(1));state.acceptPriceChange(quote(125));
  assert.equal(h.render('user-a',cart(1)).quote.total,125);assert.equal(h.requests.length,2);h.dispose();
});

test('a delayed price-change response cannot erase the current cart quote',async()=>{
  const h=harness();h.render('user-a',cart(1));await respond(h.requests[0],100);
  const old=h.render('user-a',cart(1));
  h.render('user-a',cart(2));await respond(h.requests[1],200);
  old.acceptPriceChange(quote(125));
  const current=h.render('user-a',cart(2));
  assert.equal(current.quote.total,200);assert.equal(current.loading,false);h.dispose();
});
