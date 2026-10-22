const test=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const {loadSource}=require('./helpers/load-source.cjs');
const {findInitialFurniturePlacement,wallAttachedPiece,furnitureWallId,initialPlacementFailure}=loadSource('src/lib/furnitureAttachment.ts');
const {getRoomGeometry}=loadSource('src/lib/roomGeometry.ts');
const {roomTemplateOutline}=loadSource('src/lib/roomPolygon.ts');
const {isPlacementValid,isInsideRoom}=loadSource('src/three/collision.ts');
const {cameraPlacementHints}=loadSource('src/three/RoomPlacementHints.tsx');
const {roomPlacementContext}=loadSource('src/three/roomPlacement.ts');
const {syncDesignRooms}=loadSource('src/lib/roomDesign.ts');
const {roomContacts,defaultConnection}=loadSource('src/lib/roomLayout.ts');
const room=(width=5,depth=4)=>({width,depth,height:2.7,outline:roomTemplateOutline('rectangle',width,depth),openings:[]});
const piece=(id,w=.8,d=.6,h=1)=>({instanceId:id,productId:id,x:0,z:0,rotation:0,color:'oak',material:'wood',details:{name:id,dimensions:{w,d,h}}});

test('camera centre prefers a visible interior wall rather than the hidden cutaway face',()=>{
  const shape=room();
  for(const sign of [1,-1]) {
    const camera=new THREE.PerspectiveCamera(40,1.6,.1,300);camera.position.set(0,2,6*sign);camera.lookAt(0,1,-2*sign);
    const hints=cameraPlacementHints(camera,shape);assert.ok(hints.walls.length);
    const wall=getRoomGeometry(shape).segments.find(s=>furnitureWallId(s)===hints.walls[0].segmentId);
    assert.ok(wall.nz*sign>0,'far interior wall should be preferred');
    const shelf={...piece('shelf',.8,.3,.4),placement:{surfaces:['wall'],defaultElevation:1.25}};
    const placed=findInitialFurniturePlacement(shelf,[],shape,'r',hints);
    assert.equal(placed.attachment.segmentId,hints.walls[0].segmentId);assert.equal(placed.elevation,1.25);
  }
});

test('floor adds use the preferred camera point, avoid occupancy and keep the source immutable',()=>{
  const source=piece('chair'),before=structuredClone(source),shape=room();
  const hints={floor:{x:1,z:.5}};
  const first=findInitialFurniturePlacement(source,[],shape,'r',hints);assert.equal(first.x,1);assert.equal(first.z,.5);
  const next=findInitialFurniturePlacement({...source,instanceId:'second'},[first],shape,'r',hints);
  assert.ok(next);assert.ok(isPlacementValid(next,[first],shape));assert.notDeepEqual([next.x,next.z],[1,.5]);assert.deepEqual(source,before);
});

test('a piece that only fits after a quarter turn is added without changing its dimensions',()=>{
  const shape=room(2,4),source=piece('long',3,1,1);
  const placed=findInitialFurniturePlacement(source,[],shape,'r');assert.ok(placed);assert.equal(placed.rotation,Math.PI/2);assert.ok(isPlacementValid(placed,[],shape));
  assert.deepEqual(source.details.dimensions,{w:3,d:1,h:1});assert.equal(source.rotation,0);
});

test('concave notches and invalid camera hints fall back to valid local geometry',()=>{
  const shape={...room(),outline:roomTemplateOutline('u',5,4)};
  for(const floor of [{x:0,z:2},{x:NaN,z:0},{x:Infinity,z:0},{x:1e100,z:1e100}]) {
    const placed=findInitialFurniturePlacement(piece('item',.5,.5,.6),[],shape,'r',{floor});assert.ok(placed);assert.ok(isInsideRoom(placed,shape));
  }
});

test('wall search finds free endpoint gaps missed by the former five fractional samples',()=>{
  const shape=room(),geometry=getRoomGeometry(shape),wall=geometry.segments[0],id=furnitureWallId(wall);
  const collisionRoom={...shape,placementGeometry:{...geometry,segments:[wall]}};
  const shelf={...piece('new',.3,.2,.3),placement:{surfaces:['wall'],defaultElevation:1.4}};
  const occupied=[.1,.25,.5,.75,.9].map((fraction,i)=>wallAttachedPiece({...shelf,instanceId:`old-${i}`},shape,'r',id,wall.length*fraction,1.4));
  const placed=findInitialFurniturePlacement(shelf,occupied,collisionRoom,'r');assert.ok(placed);assert.equal(placed.attachment.segmentId,id);assert.ok(isPlacementValid(placed,occupied,collisionRoom));
});

test('new furniture stays in the active room and wall hints cannot attach to an open join',()=>{
  const a={...room(4,4),id:'a',name:'a',type:'living',position:{x:0,z:0},pieces:[]};
  const b={...room(4,4),id:'b',name:'b',type:'living',position:{x:4,z:0},pieces:[]};
  const connection={...defaultConnection(roomContacts(a,b)[0],[a,b]),kind:'open'};
  const design=syncDesignRooms({...a,id:'design',name:'Test',size:'40',createdAt:1,updatedAt:1,activeRoomId:'a',rooms:[a,b],connections:[connection]});
  const context=roomPlacementContext(design);
  const placed=findInitialFurniturePlacement(piece('floor'),context.pieces,context.room,'a',{floor:{x:4,z:0}});assert.ok(placed);assert.ok(isInsideRoom(placed,a));
  const east=getRoomGeometry(a).segments.find(s=>s.nx<-.9);
  const shelf=findInitialFurniturePlacement({...piece('shelf',.6,.3,.3),placement:{surfaces:['wall']}},[],context.room,'a',{walls:[{segmentId:furnitureWallId(east),along:2}]});
  assert.ok(shelf);assert.notEqual(shelf.attachment.segmentId,furnitureWallId(east));
  const full={...piece('filled',4,4,2),x:0,z:0};
  const overlapping=findInitialFurniturePlacement(piece('no-spill'),[full],context.room,'a');
  assert.ok(overlapping,'occupied floor may be used when overlap is allowed');
  assert.ok(isInsideRoom(overlapping,a),'do not silently add into the empty neighbouring room');
});

test('surface-only products require an authored support and failure guidance matches the domain',()=>{
  const shape=room(),source={...piece('vase',.2,.2,.4),placement:{surfaces:['surface']}};
  assert.equal(findInitialFurniturePlacement(source,[],shape,'r'),null);
  assert.match(initialPlacementFailure(source),/тулгуур/);
  assert.match(initialPlacementFailure({...source,placement:{surfaces:['wall']}}),/Хананд/);
  const parent={...piece('table',1,1,.8),placement:{surfaces:['floor'],supportSurfaces:[{id:'top',width:1,depth:1,elevation:.8}]}};
  const placed=findInitialFurniturePlacement(source,[parent],shape,'r');assert.equal(placed.attachment.kind,'surface');assert.equal(placed.elevation,.8);
});

test('rapid sequential store adds keep both instances and one undo each; duplicate IDs and failures change nothing',t=>{
  const oldStorage=global.localStorage,oldWindow=global.window,saved=new Map();
  global.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
  global.window={localStorage:global.localStorage};
  t.after(()=>{global.localStorage=oldStorage;global.window=oldWindow;});
  const {useDesigns:store}=loadSource('src/store/designs.ts');store.getState().createNew('40','Test','living',room());
  const add=store.getState().placeFurniture;
  const first=add(piece('one'),{floor:{x:0,z:0}}),second=add(piece('two'),{floor:{x:0,z:0}});
  assert.ok(first.piece);assert.ok(second.piece);assert.equal(store.getState().current.pieces.length,2);assert.equal(store.getState().past.length,2);
  assert.ok(isPlacementValid(second.piece,[first.piece],store.getState().current));
  const before=store.getState().current,history=store.getState().past.length;
  assert.equal(add(piece('one')).piece,null);assert.equal(add(piece('giant',100,100,4)).piece,null);assert.equal(store.getState().current,before);assert.equal(store.getState().past.length,history);
  store.getState().undo();assert.deepEqual(store.getState().current.pieces.map(p=>p.instanceId),['one']);
  store.getState().redo();assert.equal(store.getState().current.pieces.length,2);
  store.getState().saveCurrent();
  const reloaded=loadSource('src/store/designs.ts').useDesigns.getState().current;
  assert.deepEqual(reloaded.pieces.map(p=>p.instanceId),['one','two']);
  store.getState().beginEdit();const editing=store.getState().current;assert.equal(add(piece('during-drag')).piece,null);assert.equal(store.getState().current,editing);store.getState().endEdit();
});
