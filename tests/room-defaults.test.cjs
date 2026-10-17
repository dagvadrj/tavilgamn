const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const ceiling = loadSource('src/lib/roomCeiling.ts');
const rooms = loadSource('src/lib/roomDesign.ts');
const polygon = loadSource('src/lib/roomPolygon.ts');
const shape = { width:5, depth:4, height:2.7 };
const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];

test('downlight count scales with dimensions, remains within polygons and columns and has a fixed upper budget',()=>{
 assert.equal(ceiling.automaticCeilingFixtures(shape,'room').length,4);
 assert.equal(ceiling.automaticCeilingFixtures({...shape,width:6,depth:6},'room').length,9);
 const large=ceiling.automaticCeilingFixtures({...shape,width:20,depth:20},'room');
 assert.equal(large.length,16);
 for(const type of Object.keys(polygon.ROOM_TEMPLATES)) {
  const room={...shape,outline:polygon.roomTemplateOutline(type,5,4)};
  const fixtures=ceiling.automaticCeilingFixtures(room,'room');
  assert.ok(fixtures.length>0);assert.ok(fixtures.length<=ceiling.MAX_ROOM_FIXTURES);
  assert.ok(fixtures.every(f=>f.kind==='recessed' && ceiling.fixtureFitsCeiling(room,f)));
  assert.deepEqual(ceiling.automaticCeilingFixtures(room,'room'),fixtures);
  assert.equal(new Set(fixtures.map(f=>f.id)).size,fixtures.length);
 }
 const columnRoom={...shape,columns:[{id:'column',x:0,z:0,width:1.8,depth:1.5}]};
 assert.ok(ceiling.automaticCeilingFixtures(columnRoom,'room').every(f=>ceiling.fixtureFitsCeiling(columnRoom,f)));
});

test('automatic layout migrates untouched legacy lamps and follows resizing, saving and undo while manual and removed lights stay authored',()=>{
 const original=rooms.newDesignRoom('living',[]);
 assert.equal(original.lighting.fixtureLayout,'auto');
 const legacy={...original,lighting:{...original.lighting,fixtureLayout:undefined,fixtures:[{id:`ceiling-${original.id}`,x:0,z:0,intensity:18,color:'#ffe3b3'}]}};
 assert.equal(rooms.cloneRoom(legacy).lighting.fixtures.length,4);
 const moved=structuredClone(legacy);moved.lighting.fixtures[0].x=.2;
 assert.equal(rooms.cloneRoom(moved).lighting.fixtureLayout,'manual');
 assert.equal(rooms.cloneRoom(moved).lighting.fixtures[0].x,.2);
 const oldStorage=global.localStorage,oldWindow=global.window,saved=new Map();
 global.localStorage={getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)};global.window={localStorage:global.localStorage};
 try {
  const {useDesigns:s}=loadSource('src/store/designs.ts');
  s.getState().createNew('80','Lighting','living',shape);
  s.getState().updateRoom({width:6,depth:6});assert.equal(s.getState().current.lighting.fixtures.length,9);
  s.getState().undo();assert.equal(s.getState().current.lighting.fixtures.length,4);
  s.getState().redo();assert.equal(s.getState().current.lighting.fixtures.length,9);
  s.getState().saveCurrent();s.getState().loadDesign(s.getState().current.id);assert.equal(s.getState().current.lighting.fixtures.length,9);
  s.getState().updateRoom({lighting:{...s.getState().current.lighting,fixtureLayout:'manual',fixtures:[]}});
  s.getState().updateRoom({width:7,depth:7});assert.equal(s.getState().current.lighting.fixtures.length,0);
 } finally {global.localStorage=oldStorage;global.window=oldWindow;}
});

test('large automatic rooms retain every housing but bound light sources and keep one working shadow source',()=>{
 const frames=[];
 const react={...React,useMemo:fn=>fn(),useRef:value=>({current:value}),useEffect:()=>{}};
 const {RoomLighting}=loadSource('src/three/RoomStructure.tsx',{
  react,'@react-three/fiber':{useFrame:fn=>frames.push(fn),useThree:fn=>fn({invalidate(){}})},
  './roomMaterials':{useRoomMaterial:()=>({})},'./OpeningMesh':{OpeningMesh:()=>null},
 });
 const base=rooms.newDesignRoom('living',[]),room=rooms.cloneRoom({...base,width:20,depth:20});
 const d={...room,id:'large',activeRoomId:room.id,name:'Large',size:'80',roomType:'living',createdAt:0,updatedAt:0,lighting:{...room.lighting,timeOfDay:21}};
 const lamps=nodes(RoomLighting({design:d,includeSun:false})).filter(n=>typeof n.type==='function'&&n.props.fixture);
 assert.equal(lamps.length,16);assert.equal(lamps.filter(n=>n.props.sourceIntensity>0).length,6);
 assert.equal(lamps.filter(n=>n.props.shadows && n.props.sourceIntensity>0).length,1);
 assert.ok(Math.abs(lamps.reduce((sum,n)=>sum+n.props.sourceIntensity,0)-room.lighting.fixtures.reduce((sum,f)=>sum+f.intensity,0))<1e-8);
 const source=lamps.find(n=>n.props.sourceIntensity>0), rendered=source.type(source.props);
 const housing=nodes(rendered).find(n=>n.type==='group'&&n.props.ref);
 housing.props.ref.current=new THREE.Group();
 frames.at(-1)({camera:{position:{y:25}}});assert.equal(housing.props.ref.current.visible,false);
 frames.at(-1)({camera:{position:{y:1.6}}});assert.equal(housing.props.ref.current.visible,true);
 assert.ok(nodes(rendered).find(n=>n.type==='spotLight').props.intensity>0);
 assert.equal(nodes(lamps.find(n=>n.props.sourceIntensity===0).type(lamps.find(n=>n.props.sourceIntensity===0).props)).filter(n=>n.type==='spotLight'||n.type==='pointLight').length,0);
});

test('new opening choices expose one standard door and keep older double doors readable',()=>{
 const openings=loadSource('src/lib/roomOpenings.ts');
 assert.deepEqual(openings.PLANNER_OPENING_TEMPLATES.filter(t=>t.kind==='door').map(t=>t.id),['door-single']);
 assert.equal(openings.createOpening('door-double','north').width,1.6);
 assert.equal(openings.createOpening('door-single','north').open,false);
 assert.equal(openings.PLANNER_OPENING_TEMPLATES.filter(t=>t.kind==='window').length,6);
});
