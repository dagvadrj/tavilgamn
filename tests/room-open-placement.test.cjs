const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const mocks={'@/store/catalog':{getProduct:id=>({dimensions:{w:id==='sofa'?2:1,d:1,h:id==='tall'?3:1}})}};
const {roomPlacementContext,SEAM_FURNITURE_NOTICE}=loadSource('src/three/roomPlacement.ts',mocks);
const collision=loadSource('src/three/collision.ts',mocks);
const {syncDesignRooms}=loadSource('src/lib/roomDesign.ts');
const layout=loadSource('src/lib/roomLayout.ts');
const room=(id,x=0,z=0)=>({id,name:id,type:'living',width:4,depth:4,height:2.7,wallColor:'#fff',floorColor:'#ccc',position:{x,z},pieces:[]});
const piece=(id='sofa',x=2,z=0)=>({instanceId:id,productId:id,x,z,rotation:0,color:'#fff',material:'fabric'});
const connection=(a,b,kind='open')=>({...layout.defaultConnection(layout.roomContacts(a,b)[0],[a,b]),kind});
const design=(rooms,connections,activeRoomId=rooms[0].id)=>syncDesignRooms({id:'plan',name:'Plan',size:'40',createdAt:1,updatedAt:1,...rooms[0],id:'plan',rooms,activeRoomId,connections});

test('open rooms allow full footprints over the seam and snapping ignores the removed wall',()=>{
  const a=room('a'),b=room('b',4),ctx=roomPlacementContext(design([a,b],[connection(a,b)]));
  assert.equal(collision.isPlacementValid(piece(),ctx.pieces,ctx.room),true);
  assert.equal(collision.isPlacementValid(piece('sofa',2.1),ctx.pieces,ctx.room),true);
  assert.equal(collision.snapToWall(piece('sofa',1.2),ctx.room).x,1.2);
  assert.equal(collision.isPlacementValid(piece('sofa',5.5),ctx.pieces,ctx.room),false);
  const door=roomPlacementContext(design([a,b],[connection(a,b,'door')]));
  assert.equal(collision.isPlacementValid(piece(),door.pieces,door.room),false);
});
test('partial joins and columns retain exact unoccupied floor cells',()=>{
  const a=room('a'),b=room('b',4,2.8),ctx=roomPlacementContext(design([a,b],[connection(a,b)]));
  assert.equal(collision.isPlacementValid(piece('sofa',2,1.4),[],ctx.room),true);
  assert.equal(collision.isPlacementValid(piece('sofa',2,.8),[],ctx.room),false);
  const c={...room('c',4),columns:[{id:'column',x:.1,z:1.5,width:.4,depth:1}]};
  const columnCtx=roomPlacementContext(design([a,c],[connection(a,c)]));
  assert.equal(collision.isPlacementValid(piece(),[],columnCtx.room),false);
});
test('collision uses neighbour coordinates and per-room ceiling heights',()=>{
  const a=room('a'),b={...room('b',4),height:3.5,pieces:[piece('other',-1.2)]};
  const ctx=roomPlacementContext(design([a,b],[connection(a,b)]));
  assert.equal(collision.isPlacementValid(piece(),ctx.pieces,ctx.room),false);
  assert.equal(collision.isPlacementValid(piece('tall',4),[],ctx.room),true);
  assert.equal(collision.isPlacementValid(piece('tall',2),[],ctx.room),false);
  const copy=collision.findFreePlacement({...piece(),instanceId:'copy'},ctx.pieces,ctx.room);
  assert.ok(copy);assert.equal(collision.isPlacementValid(copy,ctx.pieces,ctx.room),true);
});
test('closed internal seams remain blocked when a third room connects the floor component',()=>{
  const a=room('a'),b=room('b',4),c=room('c',0,4),d=room('d',4,4);
  const ctx=roomPlacementContext(design([a,b,c,d],[connection(a,c),connection(c,d),connection(d,b),connection(a,b,'door')]));
  assert.equal(collision.isPlacementValid(piece(),[],ctx.room),false);
  assert.equal(collision.isPlacementValid(piece('sofa',2,4),[],ctx.room),true);
});
test('separating either room and adding a door are blocked until seam furniture moves',()=>{
  const {useDesigns}=loadSource('src/store/designs.ts',mocks);
  const a={...room('a'),pieces:[piece()]},b=room('b',4),c=connection(a,b),saved=design([a,b],[c]);
  useDesigns.setState({current:saved,past:[],future:[],transaction:null});
  assert.equal(useDesigns.getState().moveRoom('b',{x:8,z:0},false),SEAM_FURNITURE_NOTICE);
  assert.equal(useDesigns.getState().moveRoom('a',{x:-4,z:0},false),SEAM_FURNITURE_NOTICE);
  assert.equal(useDesigns.getState().updateConnection(c.id,{kind:'door'}),SEAM_FURNITURE_NOTICE);
  assert.deepEqual(useDesigns.getState().current,saved);assert.equal(useDesigns.getState().past.length,0);
  useDesigns.getState().updatePieces([piece('sofa',0)]);
  assert.equal(useDesigns.getState().moveRoom('b',{x:8,z:0},false),null);
  assert.equal(useDesigns.getState().current.connections.length,0);
  useDesigns.getState().undo();assert.equal(useDesigns.getState().current.connections.length,1);
});
test('rotated seam footprints also block separation',()=>{
  const {layoutFurnitureIssue}=loadSource('src/three/roomPlacement.ts',mocks);
  const a={...room('a'),pieces:[{...piece('sofa',1.8),rotation:Math.PI/4}]},b=room('b',4),c=connection(a,b),saved=design([a,b],[c]);
  assert.equal(layoutFurnitureIssue(saved,[a,{...b,position:{x:8,z:0}}],[]),SEAM_FURNITURE_NOTICE);
});
