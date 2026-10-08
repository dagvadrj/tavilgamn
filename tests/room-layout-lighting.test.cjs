const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const layout=loadSource('src/lib/roomLayout.ts');
const lighting=loadSource('src/lib/roomLighting.ts');
const rooms=loadSource('src/lib/roomDesign.ts');
const room=(id,x=0,z=0,width=4,depth=4)=>({id,name:id,type:'living',width,depth,height:2.7,wallColor:'#ffffff',floorColor:'#ccbbaa',pieces:[],position:{x,z}});
const legacy=()=>({id:'legacy',name:'Plan',size:'40',width:4,depth:4,height:2.7,wallColor:'#ffffff',floorColor:'#ccbbaa',pieces:[],createdAt:1,updatedAt:1});

test('old rooms get nonoverlapping positions and cloning preserves local contents',()=>{
  const old=rooms.syncDesignRooms({...legacy(),rooms:[{...room('legacy-room-1'),position:undefined},{...room('second'),position:undefined,pieces:[{instanceId:'sofa',productId:'sofa',x:1,z:2,rotation:0,color:'#fff',material:'fabric'}]}]});
  assert.equal(old.rooms.length,2);assert.equal(layout.roomsOverlap(...old.rooms),false);assert.ok(old.rooms[1].position.x>4);
  const next=rooms.syncDesignRooms(JSON.parse(JSON.stringify(old)));next.rooms[1].position.x=99;
  assert.notEqual(old.rooms[1].position.x,99);assert.equal(next.rooms[1].pieces[0].x,1);
});
test('all four directions snap opposing walls, while overlap and corner contact do not connect',()=>{
  const a=room('a');
  for(const p of [{x:4.16,z:0},{x:-4.16,z:0},{x:0,z:4.16},{x:0,z:-4.16}]){
    const b=room('b',10),result=layout.snapRoomPosition(b,[a,b],p);
    assert.equal(result.valid,true);assert.equal(result.snapped,true);
    const moved={...b,position:result.position};assert.equal(layout.roomsOverlap(a,moved),false);assert.equal(layout.roomContacts(a,moved).length,1);
  }
  assert.equal(layout.snapRoomPosition(room('b'),[a,room('b')],{x:0,z:0}).valid,false);
  assert.deepEqual(layout.roomContacts(a,room('b',4,4)),[]);
});
test('notches are respected by overlap checks and missing wall spans cannot connect',()=>{
  const a={...room('a'),wallFeatures:[{id:'notch',kind:'inset',wall:'east',offset:1,length:2,depth:1}]};
  const b=room('b',1.5,0,1,1);
  assert.equal(layout.roomsOverlap(a,b),false);
  assert.deepEqual(layout.roomContacts(a,b),[]);
  assert.equal(layout.roomsOverlap(a,room('c',0,0,1,1)),true);
});
test('open connection cuts only the shared span on both sides and removes baseboards there',()=>{
  const a=room('a'),b=room('b',4,1,4,2),all=[a,b];
  const contact=layout.roomContacts(a,b)[0];assert.equal(contact.length,2);
  const c={...layout.defaultConnection(contact,all),kind:'open'};
  const ga=layout.connectionGeometry(a,all,[c]),gb=layout.connectionGeometry(b,all,[c]);
  assert.equal(ga.cuts.length,1);assert.equal(ga.cuts[0].to-ga.cuts[0].from,2);assert.equal(ga.cuts[0].wallId,'east');
  assert.equal(gb.cuts[0].to-gb.cuts[0].from,2);assert.equal(ga.openings.length+gb.openings.length,0);
  assert.deepEqual(layout.connectionGeometry(a,all,[]).cuts,[]);
});
test('shared doorway is cut and rendered once, and its centre remains inside the overlap',()=>{
  const a=room('a'),b=room('b',4,1,4,2),all=[a,b],contact=layout.roomContacts(a,b)[0];
  for(const position of [0,.5,1]){
    const c={...layout.defaultConnection(contact,all),position};
    const ga=layout.connectionGeometry(a,all,[c]),gb=layout.connectionGeometry(b,all,[c]);
    assert.equal(ga.openings.length+gb.openings.length,1);assert.ok(Math.abs(ga.cuts[0].to-ga.cuts[0].from-.9)<1e-8);
    assert.ok(ga.cuts[0].from>=2+.059);assert.ok(ga.cuts[0].to<=4-.059);
    assert.equal(gb.cuts[0].to-gb.cuts[0].from,2);
  }
});
test('taller room owns the shared doorway and moving away invalidates its connection',()=>{
  const a=room('a'),b={...room('b',4),height:3},all=[a,b],c=layout.defaultConnection(layout.roomContacts(a,b)[0],all);
  assert.equal(layout.connectionGeometry(a,all,[c]).openings.length,0);assert.equal(layout.connectionGeometry(b,all,[c]).openings.length,1);
  assert.equal(layout.validConnections([a,{...b,position:{x:5,z:0}}],[c]).length,0);
  assert.equal(layout.validConnections(all,[{...c,doorWidth:8}]).length,0);
});
test('joining hides exterior windows in the common wall without deleting them',()=>{
  const a={...room('a'),openings:[{id:'window',kind:'window',templateId:'window-fixed',wallId:'east',position:.5,width:1.2,height:1.2,sillHeight:.9,hinge:'left',swing:'inward',open:false}]},b=room('b',4),all=[a,b],c=layout.defaultConnection(layout.roomContacts(a,b)[0],all);
  assert.equal(layout.connectionGeometry(a,all,[c]).visibleOpenings.length,0);assert.equal(a.openings.length,1);assert.equal(layout.connectionGeometry(a,all,[]).visibleOpenings.length,1);
});
test('time controls sunlight, automatic lamps at 20:00, and independent manual lamp intensity',()=>{
  const base={mode:'day',ambient:.65,sunlight:1.8,fixtures:[]};
  for(const timeOfDay of [6,8,12,19.75])assert.equal(lighting.solarLighting({...base,timeOfDay}).lampsOn,false);
  for(const timeOfDay of [0,5.75,20,21,23.75]){const s=lighting.solarLighting({...base,timeOfDay});assert.equal(s.lampsOn,true);assert.equal(s.daylight,0);}
  assert.notEqual(lighting.solarLighting({...base,timeOfDay:8}).angle,lighting.solarLighting({...base,timeOfDay:16}).angle);
  assert.equal(lighting.solarLighting({...base,timeOfDay:12,autoLights:false}).lampsOn,true);
  assert.equal(lighting.lightingTime({...base,mode:'evening'}),21);assert.equal(lighting.formatLightingTime(20.25),'20:15');
});
test('room captions fade near the camera and reappear when zooming out',()=>{
  assert.equal(lighting.roomLabelOpacity(3,4),0);assert.equal(lighting.roomLabelOpacity(10,4),1);
  const samples=[4,5,6,7,8].map(d=>lighting.roomLabelOpacity(d,4));assert.ok(samples.every((n,i)=>i===0||n>=samples[i-1]));
});
test('new rooms include an automatic ceiling lamp; deliberately removed lamps stay removed',()=>{
  const a=rooms.newDesignRoom('living',[]);assert.equal(a.lighting.fixtures.length,1);assert.equal(a.lighting.autoLights,true);
  assert.deepEqual(rooms.cloneRoom({...a,lighting:{...a.lighting,fixtures:[]}}).lighting.fixtures,[]);
});

test('real store persists room movement and connection options with undo, redo, and shared solar time',()=>{
  const oldStorage=global.localStorage,oldWindow=global.window;
  const saved=new Map();global.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};global.window={localStorage:global.localStorage};
  try {
    const {useDesigns:store}=loadSource('src/store/designs.ts');store.getState().createNew('40','Plan','living',{width:4,depth:4,height:2.7});
    store.getState().addRoom('bedroom');let current=store.getState().current;
    const [a,b]=current.rooms;assert.equal(layout.roomsOverlap(a,b),false);
    assert.equal(store.getState().moveRoom(b.id,{x:4,z:0}),null);current=store.getState().current;
    assert.equal(current.connections.length,1);const id=current.connections[0].id;
    assert.equal(store.getState().updateConnection(id,{kind:'open'}),null);
    store.getState().undo();assert.equal(store.getState().current.connections[0].kind,'door');store.getState().redo();assert.equal(store.getState().current.connections[0].kind,'open');
    const before=JSON.stringify(store.getState().current);assert.ok(store.getState().moveRoom(b.id,{x:0,z:0}));assert.equal(JSON.stringify(store.getState().current),before);
    store.getState().updateRoom({lighting:{...store.getState().current.lighting,timeOfDay:21,mode:'evening'}});
    assert.ok(store.getState().current.rooms.every(r=>r.lighting.timeOfDay===21));
    store.getState().selectRoom(a.id);assert.equal(store.getState().current.lighting.timeOfDay,21);
    store.getState().saveCurrent();const persisted=JSON.parse(saved.get('casa-designs-guest')).state;
    assert.equal(persisted.current.connections[0].kind,'open');assert.equal(persisted.current.rooms[1].position.x,4);
    assert.equal(store.getState().moveRoom(b.id,{x:5,z:0}),null);assert.equal(store.getState().current.connections.length,0);
    store.getState().undo();assert.equal(store.getState().current.connections.length,1);
  } finally {global.localStorage=oldStorage;global.window=oldWindow;}
});

test('shared-wall CSG actually removes the open passage on both sides and keeps unrelated wall solid',()=>{
  const THREE=require('three');
  const {createWallGeometry}=loadSource('src/three/wallCsg.ts');
  const {getRoomGeometry}=loadSource('src/lib/roomGeometry.ts');
  const a=room('a'),b=room('b',4,1,4,2),all=[a,b],c={...layout.defaultConnection(layout.roomContacts(a,b)[0],all),kind:'open'};
  for(const r of all){
    const data=layout.connectionGeometry(r,all,[c]);
    const segment=getRoomGeometry(r).segments.find(s=>layout.sharedCutsForSegment(r,s,data.cuts).length);
    const geometry=createWallGeometry(segment.length,r.height,.12,layout.sharedCutsForSegment(r,segment,data.cuts));
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
    const mid=(segment.a.z+segment.b.z)/2;
    const along=(1-layout.roomPosition(r).z-mid)*(segment.b.z-segment.a.z)/segment.length;
    const hits=new THREE.Raycaster(new THREE.Vector3(along,0,2),new THREE.Vector3(0,0,-1)).intersectObject(mesh);
    assert.equal(hits.length,0,'the common span must contain no wall triangles');
    if(r.id==='a')assert.ok(new THREE.Raycaster(new THREE.Vector3(-1.5,0,2),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length>0);
    geometry.dispose();mesh.material.dispose();
  }
});
test('pre-upgrade saves with empty light lists receive one default automatic lamp',()=>{
  const saved=rooms.syncDesignRooms({...legacy(),lighting:{mode:'day',ambient:.65,sunlight:1.8,fixtures:[]}});
  assert.equal(saved.lighting.fixtures.length,1);assert.equal(saved.lighting.autoLights,true);
});
