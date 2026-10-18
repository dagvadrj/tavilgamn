const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { NextRequest } = require('next/server');
const { loadSource } = require('./helpers/load-source.cjs');
const delivery = loadSource('src/lib/merchantDelivery.ts');
const { DELIVERY_STAGES } = delivery;
const id = '11111111-1111-4111-8111-111111111111', driverId = '22222222-2222-4222-8222-222222222222';
const order = (stage = 'prepared') => ({ id, stage, version: 2, items: [], subtotal: 100, delivery: { name: 'Buyer', phone: '99112233', address: 'Test address' }, createdAt: '2026-10-18T00:00:00Z', updatedAt: '2026-10-18T00:00:00Z', completedAt: null, driver: null, paymentStatus: 'paid', cancellationStatus: null });
const staff = { id: driverId, name: 'Driver', phone: '99112233', vehicle: 'Porter', active: true, version: 0 };
const nodes = tree => React.isValidElement(tree) ? [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)] : [];
function runtime() {
  let slots = [], cursor = 0, pending = [], dirty = false;
  return {
    react: { ...React, useId: () => 'test-id', useRef(initial) { const at = cursor++; return slots[at] ??= { current: initial }; },
      useState(initial) { const at = cursor++; if (!(at in slots)) slots[at] = { value: typeof initial === 'function' ? initial() : initial }; const slot=slots[at]; return [slot.value, next => { slot.value = typeof next === 'function' ? next(slot.value) : next; dirty = true; }]; },
      useEffect(fn, deps) { const at = cursor++, old = slots[at]; if (!old || deps.some((value, index) => !Object.is(value,old.deps[index]))) { slots[at] = { deps }; pending.push(() => { old?.cleanup?.(); slots[at].cleanup = fn(); }); } },
    },
    render(fn) { for (let i = 0; i < 8; i++) { cursor = 0; pending = []; dirty = false; const result = fn(); pending.forEach(effect => effect()); if (!dirty) return result; } throw Error('Unstable hook'); },
    reset() { slots.forEach(slot => slot.cleanup?.()); slots = []; },
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
function hookHarness(t) {
  const h = runtime(), requests = []; let owner = 'owner-a';
  const { useMerchantDelivery } = loadSource('src/features/merchant/useMerchantDelivery.ts', {
    react: h.react,
    './merchantApi': { isOwner: actor => actor === owner, merchantRequest: (path, actor, options) => new Promise((resolve,reject) => requests.push({ path, actor, options, resolve, reject })) },
  });
  t.after(() => h.reset());
  return { requests, render: () => h.render(() => useMerchantDelivery(owner)), switchOwner: value => { owner = value; },
    async load(start = 0, value = order()) {
      for (const request of requests.slice(start,start + 7)) {
        if (request.path.endsWith('/staff')) request.resolve({ staff: [staff] });
        else { const stage = new URL(request.path,'http://localhost').searchParams.get('stage'); request.resolve({ orders: stage === value.stage ? [value] : [], total: stage === value.stage ? 1 : 0, hasMore: false }); }
      }
      await flush();
    },
  };
}

test('workflow permits only the next paid stage and holds cancellation requests', () => {
  for (let i = 0; i < DELIVERY_STAGES.length; i++) for (const target of DELIVERY_STAGES) assert.equal(delivery.canMoveDelivery(order(DELIVERY_STAGES[i]),target), target === DELIVERY_STAGES[i + 1]);
  assert.equal(delivery.canMoveDelivery({ ...order(),paymentStatus:'pending_payment' },'shipped'),false);
  assert.equal(delivery.canMoveDelivery({ ...order(),cancellationStatus:'requested' },'shipped'),false);
});

test('API validates input and uses the verified merchant, never client-supplied ownership', async () => {
  const calls = []; let allowed = false, failure = null;
  const mocks = { '@/lib/supabase/requireMerchant': { requireMerchant: async () => allowed ? { userId:'verified-merchant',error:null } : { error:new Response('{}',{status:401}) } },
    '@/lib/supabase/admin': { getSupabaseAdmin: () => ({ rpc: async (name,args) => { calls.push({ name,args }); return { data:{ok:true},error:failure }; } }) } };
  const routes = loadSource('src/app/api/merchant/delivery/route.ts',mocks);
  const request = (body, method = 'PATCH') => new NextRequest('http://localhost/api/merchant/delivery',{method,body:JSON.stringify(body)});
  assert.equal((await routes.PATCH(request({}))).status,401); assert.equal(calls.length,0); allowed = true;
  for (const body of [{},{orderId:id,stage:'shipped',expectedVersion:2},{orderId:id,stage:'prepared',expectedVersion:-1},{orderId:id,stage:'prepared',expectedVersion:2,driverId}]) assert.equal((await routes.PATCH(request(body))).status,400);
  assert.equal(calls.length,0);
  assert.equal((await routes.PATCH(request({orderId:id,stage:'shipped',expectedVersion:2,driverId,ownerId:'victim'}))).status,200);
  assert.deepEqual(calls[0],{name:'move_merchant_delivery_order',args:{p_actor:'verified-merchant',p_order:id,p_stage:'shipped',p_expected_version:2,p_driver:driverId}});
  failure = {code:'P0020'}; assert.equal((await routes.PATCH(request({orderId:id,stage:'shipped',expectedVersion:2,driverId}))).status,409);
  for (const query of ['?stage=unknown','?stage=prepared&page=-1','?stage=prepared&page=1.5']) assert.equal((await routes.GET(new NextRequest(`http://localhost/api/merchant/delivery${query}`))).status,400);
  const staffRoutes = loadSource('src/app/api/merchant/delivery/staff/route.ts',mocks); failure = null;
  assert.equal((await staffRoutes.POST(request({...staff,ownerId:'victim'},'POST'))).status,201);
  assert.equal(calls.at(-1).args.p_actor,'verified-merchant'); assert.equal(calls.at(-1).args.p_id,null);
  assert.equal((await staffRoutes.PUT(request({...staff,expectedVersion:0},'PUT'))).status,200);
  assert.equal(calls.at(-1).args.p_id,driverId);
  assert.equal((await staffRoutes.POST(request({...staff,phone:'not a phone'},'POST'))).status,400);
});

test('board loads every stage and staff; failures remain read-only until a successful retry', async t => {
  const h = hookHarness(t); let state = h.render(); assert.equal(state.ready,false); assert.equal(h.requests.length,7);
  h.requests[0].reject(Error('Offline')); await flush(); state = h.render(); assert.equal(state.ready,false); assert.equal(state.error,'Offline');
  assert.equal(await state.move(order(),'shipped',driverId),false); assert.equal(h.requests.length,7);
  state.reload(); h.render(); await h.load(7); state = h.render(); assert.equal(state.ready,true); assert.equal(state.columns.prepared.orders[0].id,id);
  assert.equal(state.staff[0].id,driverId);
});

test('drag mutations are serialized, acknowledge server writes and refresh instead of claiming a local move', async t => {
  const h = hookHarness(t); h.render(); await h.load(); let state = h.render();
  const pending = state.move(order(),'shipped',driverId); assert.equal(await state.move(order(),'shipped',driverId),false);
  assert.equal(h.requests.length,8); assert.deepEqual(JSON.parse(h.requests[7].options.body),{orderId:id,stage:'shipped',expectedVersion:2,driverId});
  assert.equal(h.render().columns.shipped.orders.length,0,'not moved optimistically');
  h.requests[7].reject(Error('Stale delivery version')); await pending; state = h.render();
  assert.equal(state.mutationError,'Stale delivery version'); assert.equal(state.ready,false);
  assert.equal(state.columns.prepared.orders.length,1); await h.load(8); state = h.render();
  const confirmed = state.move(order(),'shipped',driverId); h.requests[15].resolve({ok:true}); await confirmed; state = h.render();
  assert.equal(state.ready,false); await h.load(16,{...order('shipped'),version:3,driver:staff}); state = h.render();
  assert.equal(state.columns.prepared.orders.length,0); assert.equal(state.columns.shipped.orders[0].version,3);
});

test('stale reads and writes cannot leak into another merchant account', async t => {
  const h = hookHarness(t); h.render(); const old = h.requests[0]; h.switchOwner('owner-b');
  let state = h.render(); assert.equal(old.options.signal.aborted,true); assert.equal(state.columns.prepared.orders.length,0);
  await h.load(7); await h.load(0,{...order(),id:'old-account-order'}); state = h.render(); assert.equal(state.columns.prepared.orders[0].id,id);
  const pending = state.move(order(),'shipped',driverId); h.switchOwner('owner-c');
  h.requests[14].resolve({ok:true}); assert.equal(await pending,false);
  state = h.render(); assert.equal(state.message,''); assert.equal(state.columns.prepared.orders.length,0);
  await h.load(15); state = h.render(); assert.equal(state.busy,false); assert.equal(state.ready,true);
});

test('dragging prepared furniture opens staff assignment; cancel does not persist, and confirming sends the selected staff', async () => {
  const h = runtime(), moves = []; const prepared = order();
  const columns = Object.fromEntries(DELIVERY_STAGES.map(stage=>[stage,{orders:stage==='prepared'?[prepared]:[],total:stage==='prepared'?1:0,hasMore:false}]));
  const board = {columns,staff:[staff,{...staff,id:'inactive',active:false}],ready:true,busy:false,loading:false,error:null,mutationError:'',message:'',pages:Object.fromEntries(DELIVERY_STAGES.map(stage=>[stage,0])),reload(){},setPage(){},saveStaff(){},move:async(...args)=>{moves.push(args);return true;}};
  const { MerchantDeliveryBoard } = loadSource('src/features/merchant/MerchantDeliveryBoard.tsx',{
    react:{...h.react,useEffect(){}}, './useMerchantDelivery':{useMerchantDelivery:()=>board},
    '@dnd-kit/core':{DndContext:'dnd',DragOverlay:'overlay',KeyboardSensor:'keyboard',PointerSensor:'pointer',MeasuringStrategy:{Always:'always'},pointerWithin(){},rectIntersection(){},useSensor:(sensor,options)=>({sensor,options}),useSensors:(...sensors)=>sensors},
  });
  const render = ()=>h.render(()=>MerchantDeliveryBoard({owner:'owner'}));
  const context = ()=>nodes(render()).find(node=>node.type==='dnd');
  assert.equal(context().props.sensors[1].sensor,'keyboard');
  context().props.onDragEnd({active:{id},over:{id:'stage:completed'}}); assert.equal(moves.length,0);
  context().props.onDragEnd({active:{id},over:{id:'stage:shipped'}});
  let modal = nodes(render()).find(node=>typeof node.type==='function'&&node.type.name==='AssignDeliveryDialog'); assert.ok(modal); assert.equal(moves.length,0);
  // The assignment component uses the same React shim, so render it through a
  // fresh root to exercise selection independently from the board's state.
  h.reset();
  let assignment = h.render(() => modal.type(modal.props));
  assert.equal(nodes(assignment).some(node => node.type === 'option' && node.props.value === 'inactive'),false);
  await nodes(assignment).find(node=>node.type==='form').props.onSubmit({preventDefault(){}}); assert.equal(moves.length,0);
  nodes(assignment).find(node=>node.type==='select').props.onChange({target:{value:driverId}});
  assignment=h.render(()=>modal.type(modal.props));
  await nodes(assignment).find(node=>node.type==='form').props.onSubmit({preventDefault(){}});
  assert.deepEqual(moves,[[prepared,'shipped',driverId]]);
  h.reset(); moves.length=0;
  // Re-open from the board to verify cancellation independently.
  context().props.onDragEnd({active:{id},over:{id:'stage:shipped'}});
  modal = nodes(render()).find(node=>typeof node.type==='function'&&node.type.name==='AssignDeliveryDialog');
  modal.props.onClose(); assert.equal(nodes(render()).some(node=>node.type?.name==='AssignDeliveryDialog'),false); assert.equal(moves.length,0);
  context().props.onDragEnd({active:{id},over:{id:'stage:shipped'}});
  modal = nodes(render()).find(node=>node.type?.name==='AssignDeliveryDialog');
  await modal.props.onConfirm(driverId); assert.deepEqual(moves,[[prepared,'shipped',driverId]]);
  assert.equal(nodes(render()).some(node=>node.type?.name==='AssignDeliveryDialog'),false);
});

test('delivery dialogs use a native modal and block Escape only while saving', () => {
  let shown=0,closed=0,cancelled=0,prevented=0;
  const node={showModal(){shown++;},close(){closed++;}};
  const h=runtime();
  const {DeliveryDialog}=loadSource('src/features/merchant/DeliveryStaffDialog.tsx',{react:{...h.react,useRef:()=>({current:node})}});
  const props={title:'Assign',busy:false,onClose(){cancelled++;},children:null};
  let dialog=h.render(()=>DeliveryDialog(props)); assert.equal(shown,1); assert.equal(dialog.type,'dialog');
  dialog.props.onCancel({preventDefault(){prevented++;}}); assert.equal(cancelled,1);
  dialog=h.render(()=>DeliveryDialog({...props,busy:true})); dialog.props.onCancel({preventDefault(){prevented++;}});
  assert.equal(cancelled,1); assert.equal(prevented,2); h.reset(); assert.equal(closed,1);
});

test('delivery keyboard arrows target only the enabled next-stage box', () => {
  const {deliveryKeyboardCoordinates}=loadSource('src/features/merchant/MerchantDeliveryBoard.tsx'); let prevented=false;
  const context={droppableContainers:{getEnabled:()=>[{id:'stage:shipped'}]},droppableRects:new Map([['stage:shipped',{left:100,top:200,width:400,height:300}]]),collisionRect:{width:200,height:100}};
  assert.deepEqual(deliveryKeyboardCoordinates({code:'ArrowRight',preventDefault(){prevented=true;}},{context}),{x:200,y:300}); assert.equal(prevented,true);
});
