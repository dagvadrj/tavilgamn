const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const mocks={'@/store/catalog':{getProduct:id=>({dimensions:{w:1,d:1,h:id==='tall'?3:1}})}};
const {reassignFurnitureRooms}=loadSource('src/three/furnitureRoomOwnership.ts',mocks);
const {syncDesignRooms,activateDesignRoom}=loadSource('src/lib/roomDesign.ts');
const {roomPosition,defaultConnection,roomContacts}=loadSource('src/lib/roomLayout.ts');
const {SEAM_FURNITURE_NOTICE}=loadSource('src/three/roomPlacement.ts',mocks);
const room=(id,x=0,z=0)=>({id,name:id,type:'living',width:4,depth:4,height:2.7,wallColor:'#fff',floorColor:'#ccc',position:{x,z},pieces:[]});
const piece=(id='bed',x=0,z=0)=>({instanceId:id,productId:id,x,z,rotation:.25,color:'cream',material:'fabric'});
const connection=(a,b)=>({...defaultConnection(roomContacts(a,b)[0],[a,b]),kind:'open'});
const design=(rooms,connections=[])=>syncDesignRooms({...rooms[0],id:'plan',name:'Plan',size:'40',createdAt:1,updatedAt:1,activeRoomId:rooms[0].id,roomName:rooms[0].name,rooms,connections});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' != '+b);
const stateFor=design=>{const {useDesigns}=loadSource('src/store/designs.ts',mocks);useDesigns.setState({current:design,past:[],future:[],transaction:null});return useDesigns;};

test('ownership uses world coordinates and preserves instance, rotation, model and options',()=>{
 const original={...piece('bed',4,4),modelId:'model-1',customOption:{finish:'oak'}},a={...room('a',-7,-9),pieces:[original]},b=room('b',-3,-5),saved=design([a,b]);
 const next=reassignFurnitureRooms(saved,'bed'),bed=next.rooms[1].pieces[0];
 assert.equal(next.activeRoomId,'b');assert.equal(next.rooms[0].pieces.length,0);assert.equal(next.rooms[1].pieces.length,1);
 near(bed.x,0);near(bed.z,0);near(bed.x+b.position.x,original.x+a.position.x);near(bed.z+b.position.z,original.z+a.position.z);
 assert.deepEqual({...bed,x:original.x,z:original.z},original);assert.deepEqual(saved.rooms[0].pieces,[original]);assert.deepEqual(saved.rooms[1].pieces,[]);
 assert.deepEqual(syncDesignRooms(JSON.parse(JSON.stringify(next))),next);
});
test('drag remains in source coordinates until release and transfers in one undoable edit',()=>{
 const a={...room('a'),pieces:[piece()]},b=room('b',4),store=stateFor(design([a,b],[connection(a,b)]));
 store.getState().beginEdit();for(const x of [1,2.2,3,4])store.getState().updatePieces([piece('bed',x)]);
 assert.equal(store.getState().current.activeRoomId,'a');assert.equal(store.getState().current.rooms[0].pieces.length,1);assert.equal(store.getState().past.length,0);
 store.getState().endEdit();let next=store.getState().current;assert.equal(next.activeRoomId,'b');assert.equal(next.rooms[0].pieces.length,0);near(next.pieces[0].x,0);assert.equal(store.getState().past.length,1);
 store.getState().endEdit();assert.equal(store.getState().past.length,1);
 store.getState().undo();next=store.getState().current;assert.equal(next.activeRoomId,'a');near(next.pieces[0].x,0);assert.equal(next.rooms[1].pieces.length,0);
 store.getState().redo();next=store.getState().current;assert.equal(next.activeRoomId,'b');near(next.pieces[0].x,0);assert.equal(next.rooms[0].pieces.length,0);
 // Keyboard/inspector movement outside a drag also transfers back immediately.
 store.getState().updatePieces([piece('bed',-4)]);next=store.getState().current;assert.equal(next.activeRoomId,'a');near(next.pieces[0].x,0);assert.equal(next.rooms[1].pieces.length,0);
});
test('a seam centre keeps its owner, crossing it reassigns but still blocks closing the seam',()=>{
 const a={...room('a'),pieces:[piece('bed',2)]},b=room('b',4),c=connection(a,b),store=stateFor(design([a,b],[c]));
 let next=reassignFurnitureRooms(store.getState().current);assert.equal(next.rooms[0].pieces.length,1);assert.equal(next.rooms[1].pieces.length,0);
 store.getState().updatePieces([piece('bed',2.1)]);next=store.getState().current;assert.equal(next.activeRoomId,'b');near(next.pieces[0].x,-1.9);
 assert.equal(store.getState().moveRoom('b',{x:8,z:0},false),SEAM_FURNITURE_NOTICE);assert.equal(store.getState().updateConnection(c.id,{kind:'door'}),SEAM_FURNITURE_NOTICE);
 store.getState().updatePieces([piece('bed',0)]);assert.equal(store.getState().moveRoom('b',{x:8,z:0},false),null);
 next=store.getState().current;assert.equal(next.rooms[0].pieces.length,0);assert.equal(next.rooms[1].pieces[0].instanceId,'bed');near(next.pieces[0].x,0);near(roomPosition(next.rooms[1]).x,8);
});
test('target collisions, low ceilings, gaps and actual room voids cannot acquire furniture',()=>{
 const a={...room('a'),pieces:[piece('bed',4)]},b={...room('b',4),pieces:[piece('occupied')]};
 assert.equal(reassignFurnitureRooms(design([a,b],[connection(a,b)])).rooms[0].pieces.length,1);
 const tall={...a,pieces:[piece('tall',4)]};assert.equal(reassignFurnitureRooms(design([tall,{...b,pieces:[]}],[connection(a,b)])).rooms[0].pieces.length,1);
 const gap={...a,pieces:[piece('bed',4)]},far=room('far',8);assert.equal(reassignFurnitureRooms(design([gap,far])).rooms[0].pieces.length,1);
 const notched={...room('notched',4),wallFeatures:[{id:'inset',kind:'inset',wall:'north',offset:1,length:2,depth:1}]};
 const inVoid={...a,pieces:[piece('bed',4,-1.5)]};assert.equal(reassignFurnitureRooms(design([inVoid,notched])).rooms[0].pieces.length,1);
});
test('multiple pieces transfer exactly once without changing unaffected rooms or project counts',()=>{
 const a={...room('a'),pieces:[piece('first',3,-1),piece('second',5,1),piece('stay',0)]},b={...room('b',4),pieces:[piece('existing',0)]},c=room('c',10);
 const next=reassignFurnitureRooms(design([a,b,c],[connection(a,b)]),'second');
 assert.deepEqual(next.rooms[0].pieces.map(p=>p.instanceId),['stay']);assert.deepEqual(next.rooms[1].pieces.map(p=>p.instanceId),['existing','first','second']);assert.deepEqual(next.rooms[2].pieces,[]);
 const all=next.rooms.flatMap(r=>r.pieces);assert.equal(all.length,4);assert.equal(new Set(all.map(p=>p.instanceId)).size,4);
 assert.deepEqual(reassignFurnitureRooms(next),next);
});
test('save and reload repair an already misplaced item and preserve the new owner',()=>{
 const a={...room('a'),pieces:[piece('bed',4)]},b=room('b',4),store=stateFor(design([a,b],[connection(a,b)]));
 store.getState().saveCurrent('Saved plan');const saved=store.getState().designs[0];assert.equal(saved.rooms[0].pieces.length,0);assert.equal(saved.rooms[1].pieces[0].instanceId,'bed');
 store.getState().loadDesign(saved.id);store.getState().selectRoom('b');assert.equal(store.getState().current.pieces[0].instanceId,'bed');near(store.getState().current.pieces[0].x,0);
 const exported=JSON.parse(JSON.stringify(store.getState().current));assert.deepEqual(syncDesignRooms(exported),store.getState().current);
});
