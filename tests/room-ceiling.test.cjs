const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const {loadSource}=require('./helpers/load-source.cjs');
const ceiling=loadSource('src/lib/roomCeiling.ts');
const rooms=loadSource('src/lib/roomDesign.ts');
const layout=loadSource('src/lib/roomLayout.ts');
const shape={width:4,depth:4,height:2.7};
const tray={...ceiling.DEFAULT_ROOM_CEILING,kind:'tray',coveEnabled:true};
const fixture=(kind='flush',x=0,z=0)=>({id:'lamp',kind,x,z,color:'#ffe3b3',intensity:18,pendantDrop:.6});
const near=(a,b)=>assert.ok(Math.abs(a-b)<.000001,a+' != '+b);
const area=b=>(b.maxX-b.minX)*(b.maxZ-b.minZ);
const lighting={mode:'day',timeOfDay:12,autoLights:true,ambient:.65,sunlight:1.8,fixtures:[]};
const room=(id,x=0)=>({...shape,id,name:id,type:'living',position:{x,z:0},pieces:[],lighting,wallColor:'#ffffff',floorColor:'#ccbbaa'});
const design=(a,others=[],connections=[])=>rooms.syncDesignRooms({...a,id:'design',name:'plan',size:'40',roomName:a.name,roomType:a.type,activeRoomId:a.id,rooms:[a,...others],connections,createdAt:1,updatedAt:1});

 test('legacy ceilings default to flat and invalid saved dimensions normalize safely',()=>{
  assert.deepEqual(ceiling.normalizeRoomCeiling(),ceiling.DEFAULT_ROOM_CEILING);
  const normalized=ceiling.normalizeRoomCeiling({...tray,drop:99,borderWidth:99,coveColor:'bad',coveIntensity:-8},shape);
  assert.equal(normalized.drop,.4);assert.equal(normalized.borderWidth,.8);assert.equal(normalized.coveColor,'#ffe3b3');assert.equal(normalized.coveIntensity,0);
 });
 test('tray ceiling has exact perimeter area and respects notches and columns',()=>{
  const p=ceiling.ceilingPlan({...shape,ceiling:tray});near(p.slabs.reduce((sum,b)=>sum+area(b),0),16-3.4*3.4);
  near(ceiling.ceilingHeightAt({...shape,ceiling:tray},1.9,0),2.55);near(ceiling.ceilingHeightAt({...shape,ceiling:tray},0,0),2.7);
  assert.equal(ceiling.ceilingPlan(shape).slabs.length,0);
  const complex={...shape,ceiling:tray,wallFeatures:[{id:'notch',kind:'inset',wall:'east',offset:1,length:2,depth:1}],columns:[{id:'column',x:0,z:0,width:.4,depth:.4}]};
  const g=loadSource('src/lib/roomGeometry.ts').getRoomGeometry(complex),plan=ceiling.ceilingPlan(complex);
  for(const b of plan.slabs)for(const v of g.voids)assert.equal(b.maxX>v.minX+.000001&&b.minX<v.maxX-.000001&&b.maxZ>v.minZ+.000001&&b.minZ<v.maxZ-.000001,false);
 });
 test('lamp types fit their whole footprint and mount below lowered borders',()=>{
  assert.deepEqual(ceiling.CEILING_FIXTURE_TYPES.map(t=>t.id),['flush','recessed','pendant','linear']);
  assert.equal(ceiling.fixtureFitsCeiling(shape,fixture('linear',1.6)),false);assert.equal(ceiling.fixtureFitsCeiling(shape,fixture('linear',1.5)),true);
  const lamp=fixture('flush',1.7);near(ceiling.fixtureMountHeight({...shape,ceiling:tray},lamp),2.55);
  near(ceiling.fixtureBottomHeight(shape,fixture('pendant')),1.985);
  assert.equal(ceiling.ceilingFixturesOverlap(fixture('linear'),fixture('linear',.8)),true);
  assert.equal(ceiling.ceilingFixturesOverlap(fixture('linear'),fixture('linear',1)),false);
 });
 test('furniture clearance follows dropped ceiling and pendant footprint',()=>{
  const model={id:'tall',dimensionsW:.2,dimensionsD:.2,dimensionsH:2.6};
  const mocks={'@/lib/modelRegistry':{getDbModel:()=>model},'@/store/catalog':{getProduct:()=>undefined}};
  const placement=loadSource('src/three/roomPlacement.ts',mocks),collision=loadSource('src/three/collision.ts',mocks);
  const piece={instanceId:'tall',productId:'tall',modelId:'tall',x:1.8,z:0,rotation:0,color:'#fff',material:'wood'};
  let ctx=placement.roomPlacementContext(design({...room('a'),ceiling:tray}));assert.equal(collision.isPlacementValid(piece,[],ctx.room),false);
  assert.equal(collision.isPlacementValid({...piece,x:0},[],ctx.room),true);
  ctx=placement.roomPlacementContext(design({...room('a'),lighting:{...lighting,fixtures:[fixture('pendant')]}}));
  assert.equal(collision.isPlacementValid({...piece,x:0},[],ctx.room),false);assert.equal(collision.isPlacementValid({...piece,x:1},[],ctx.room),true);
 });
 test('ceiling changes catch furniture owned by a neighbour across an open seam',()=>{
  const model={id:'tall',dimensionsW:1,dimensionsD:1,dimensionsH:2.6};
  const {layoutClearanceIssue}=loadSource('src/three/roomPlacement.ts',{'@/lib/modelRegistry':{getDbModel:()=>model},'@/store/catalog':{getProduct:()=>undefined}});
  const a=room('a'),b={...room('b',4),pieces:[{instanceId:'seam',productId:'tall',modelId:'tall',x:-2,z:0,rotation:0,color:'#fff',material:'wood'}]};
  const c={...layout.defaultConnection(layout.roomContacts(a,b)[0],[a,b]),kind:'open'};
  const before=design(a,[b],[c]),after=rooms.syncDesignRooms({...before,ceiling:tray});
  assert.equal(layoutClearanceIssue(before,after),true);assert.equal(layoutClearanceIssue(after,before),false);
 });
 test('ceiling and lamp types survive room switching, saving, undo and redo',()=>{
  const oldStorage=global.localStorage,oldWindow=global.window,saved=new Map();global.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};global.window={localStorage:global.localStorage};
  try{
   const {useDesigns:s}=loadSource('src/store/designs.ts');s.getState().createNew('40','plan','living',shape);const a=s.getState().current.activeRoomId;
   s.getState().updateRoom({ceiling:tray,lighting:{...lighting,fixtures:[fixture('pendant')]}});
   s.getState().addRoom('bedroom');const b=s.getState().current.activeRoomId;assert.equal(s.getState().current.ceiling.kind,'flat');
   s.getState().selectRoom(a);assert.equal(s.getState().current.ceiling.kind,'tray');assert.equal(s.getState().current.lighting.fixtures[0].kind,'pendant');
   s.getState().updateRoom({ceiling:{...tray,drop:.25}});s.getState().undo();near(s.getState().current.ceiling.drop,.15);s.getState().redo();near(s.getState().current.ceiling.drop,.25);
   s.getState().saveCurrent();const persisted=JSON.parse(saved.get('casa-designs-guest')).state.current;
   assert.equal(persisted.rooms.find(r=>r.id===a).lighting.fixtures[0].pendantDrop,.6);assert.equal(persisted.rooms.find(r=>r.id===b).ceiling.kind,'flat');
   const clone=rooms.syncDesignRooms(persisted);clone.rooms[0].ceiling.drop=.4;assert.notEqual(persisted.rooms[0].ceiling.drop,.4);
  }finally{global.localStorage=oldStorage;global.window=oldWindow;}
 });
 const reactMock={...require('react'),useMemo:fn=>fn(),useEffect:()=>{},useRef:v=>({current:v})};
 function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];}
 test('real tray geometry lowers its border and cove lamps follow the shared time',()=>{
  const {TrayCeiling}=loadSource('src/three/TrayCeiling.tsx',{'react':reactMock,'./roomMaterials':{useRoomMaterial:()=>({color:'#fff'})}});
  const d={...room('a'),ceiling:tray},day=TrayCeiling({design:d,view:'perspective'}),night=TrayCeiling({design:{...d,lighting:{...lighting,timeOfDay:21}},view:'perspective'});
  const geometry=nodes(day).find(n=>n.type==='mesh'&&n.props.geometry).props.geometry;geometry.computeBoundingBox();near(geometry.boundingBox.min.y,2.55);near(geometry.boundingBox.max.y,2.64);
  assert.equal(nodes(day).filter(n=>n.type==='pointLight').length,0);assert.ok(nodes(night).filter(n=>n.type==='pointLight').length>0);
  assert.equal(TrayCeiling({design:d,view:'plan'}),null);assert.equal(TrayCeiling({design:{...d,ceiling:{...tray,kind:'flat'}},view:'perspective'}),null);
  for(const n of nodes(night))if(n.props?.geometry)n.props.geometry.dispose();geometry.dispose();
 });
 test('ceiling controls add tray and cove together and cove-only status stays correct',()=>{
  const {RoomCeilingControls}=loadSource('src/features/room-planner/components/RoomCeilingControls.tsx');let patch;
  const tree=RoomCeilingControls({design:room('a'),onChange:v=>patch=v,beginEdit:()=>{},endEdit:()=>{},structure:false});nodes(tree).find(n=>n.type==='button').props.onClick();assert.equal(patch.kind,'tray');assert.equal(patch.coveEnabled,true);
  const {RoomLightingTimeControls}=loadSource('src/features/room-planner/components/RoomLightingTimeControls.tsx');
  const control=RoomLightingTimeControls({ceiling:tray,lighting:{...lighting,timeOfDay:21},onChange:()=>{},beginEdit:()=>{},endEdit:()=>{}});
  assert.match(JSON.stringify(nodes(control).find(n=>n.props?.role==='status').props.children),/далд гэрэл асаалттай/);
 });

test('all lamp types render distinct housings at their actual ceiling mount height',()=>{
 const {RoomLighting}=loadSource('src/three/RoomStructure.tsx',{'react':reactMock,'@react-three/fiber':{useFrame:()=>{},useThree:fn=>fn({invalidate:()=>{}})},'./roomMaterials':{useRoomMaterial:()=>({})},'./OpeningMesh':{OpeningMesh:()=>null}});
 for(const kind of ['flush','recessed','pendant','linear']){
  const f=fixture(kind,1.7),d={...room('a'),ceiling:tray,lighting:{...lighting,timeOfDay:21,fixtures:[f]}};
  const tree=RoomLighting({design:d,includeSun:false}),lamp=nodes(tree).find(n=>typeof n.type==='function'&&n.props.fixture),rendered=lamp.type(lamp.props),parts=nodes(rendered);
  near(rendered.props.position[1],ceiling.fixtureMountHeight(d,f)-.035);
  assert.ok(parts.find(n=>n.type==='spotLight').props.intensity>0);
  if(kind==='linear')assert.deepEqual(parts.find(n=>n.type==='boxGeometry').props.args,[1,.045,.12]);
  else if(kind==='pendant')assert.ok(parts.some(n=>n.type==='cylinderGeometry'&&n.props.args[2]===.6));
  else near(parts.find(n=>n.type==='cylinderGeometry').props.args[0],kind==='recessed'?.08:.19);
 }
});
test('centimetre input accepts incomplete typing and commits a complete value on blur',()=>{
 let draft=null,change,begin=0,end=0;
 const {RoomMeasureInput}=loadSource('src/features/room-planner/components/RoomMeasureInput.tsx',{'react':{...require('react'),useState:()=>[draft,v=>draft=v]}});
 const render=()=>nodes(RoomMeasureInput({label:'Уналтын өндөр',value:15,min:8,max:40,onChange:v=>change=v,beginEdit:()=>begin++,endEdit:()=>end++})).find(n=>n.type==='input');
 render().props.onFocus();render().props.onChange({target:{value:'2'}});assert.equal(change,undefined);assert.equal(render().props.value,'2');
 render().props.onChange({target:{value:'25'}});render().props.onBlur();assert.equal(change,25);assert.equal(begin,1);assert.equal(end,1);assert.equal(draft,null);
});
