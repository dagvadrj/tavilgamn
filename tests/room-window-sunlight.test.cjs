const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const THREE=require('three');
const {loadSource}=require('./helpers/load-source.cjs');
const openings=loadSource('src/lib/roomOpenings.ts');
const sun=loadSource('src/lib/roomSunlight.ts');
const rooms=loadSource('src/lib/roomDesign.ts');
const layout=loadSource('src/lib/roomLayout.ts');
const shape={width:4,depth:4,height:2.7};
const lighting={mode:'day',timeOfDay:12,ambient:.65,sunlight:1.8,autoLights:true,fixtures:[]};
const room=(id,x=0)=>({...shape,id,name:id,type:'living',position:{x,z:0},pieces:[],openings:[],wallColor:'#ffffff',floorColor:'#ccbbaa',lighting});
const plan=(a,others=[],connections=[])=>rooms.syncDesignRooms({...a,id:'design',name:'plan',size:'40',activeRoomId:a.id,roomName:a.name,roomType:a.type,rooms:[a,...others],connections,createdAt:1,updatedAt:1});
const nodes=n=>!n||typeof n!=='object'?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)];
const near=(a,b)=>assert.ok(Math.abs(a-b)<.00001,a+' != '+b);

test('catalog contains six distinct window options and minimum sizes leave positive glass dimensions',()=>{
 assert.deepEqual(openings.OPENING_TEMPLATES.filter(t=>t.kind==='window').map(t=>t.id),['window-fixed','window-sliding','window-casement','window-triple','window-panoramic','window-floor']);
 for(const template of openings.OPENING_TEMPLATES.filter(t=>t.kind==='window')){
  const o=openings.createOpening(template.id,'north'),minimum=openings.openingMinimumWidth(o),panes=openings.windowLayout(o).panes;
  assert.equal(openings.validateOpening(shape,o),null);assert.equal(openings.validateOpening(shape,{...o,width:minimum}),null);
  assert.ok((minimum-.12-(panes-1)*.048)/panes-.058>0);
  assert.ok(openings.validateOpening(shape,{...o,width:minimum-.01}));
 }
});
test('panoramic runtime window has three transparent panes and two real shadow-casting mullions',()=>{
 const {RoomWindow}=loadSource('src/three/RoomWindow.tsx',{'@react-three/drei':{RoundedBox:'rounded'}});
 const tree=RoomWindow({opening:openings.createOpening('window-panoramic','north')}),all=nodes(tree);
 assert.equal(all.filter(n=>n.type==='meshPhysicalMaterial').length,3);
 for(const n of all.filter(n=>n.type==='mesh'&&n.props.children?.[1]?.type==='meshPhysicalMaterial'))assert.equal(Boolean(n.props.castShadow),false);
 const bars=all.filter(n=>n.type==='rounded'&&n.props.args[0]===.048);assert.equal(bars.length,2);assert.ok(bars.every(n=>n.props.castShadow));near(bars[0].props.position[0],-bars[1].props.position[0]);
 const {RoomPlanPreview}=loadSource('src/components/RoomPlanPreview.tsx'),preview=RoomPlanPreview({room:{...shape,openings:[openings.createOpening('window-panoramic','north')]}});
 const mark=nodes(preview).find(n=>n.type?.name==='OpeningPlanMark'),draw=mark.type(mark.props);assert.equal(nodes(draw).filter(n=>n.props?.className==='room-plan-window-mullion').length,2);
});
test('operable window sashes swing inward or slide and return to their closed positions',()=>{
 let frame,invalidations=0;const ref={current:new THREE.Group()};
 const {RoomWindow}=loadSource('src/three/RoomWindow.tsx',{react:{...React,useRef:()=>ref,useEffect:fn=>fn()},'@react-three/drei':{RoundedBox:'rounded'},'@react-three/fiber':{useThree:select=>select({invalidate:()=>invalidations++}),useFrame:fn=>frame=fn}});
 for(const id of ['window-casement','window-sliding']){
  const o={...openings.createOpening(id,'north'),open:true},parts=nodes(RoomWindow({opening:o})).filter(n=>n.type?.name==='WindowSash');
  const first=parts[0],draw=first.type(first.props);ref.current=new THREE.Group();ref.current.position.fromArray(draw.props.position);
  for(let i=0;i<35;i++)frame({invalidate:()=>invalidations++},.05);
  if(id==='window-casement')assert.ok(ref.current.rotation.y<-.8);else assert.ok(ref.current.position.x>draw.props.position[0]+.5);
  first.type({...first.props,open:false});for(let i=0;i<35;i++)frame({invalidate:()=>invalidations++},.05);
  near(ref.current.rotation.y,0);near(ref.current.position.x,draw.props.position[0]);
 }
 assert.ok(invalidations>0);
});
test('automatic sun enters a real wall aperture on all four orientations and moves with time',()=>{
 const {createWallGeometry}=loadSource('src/three/wallCsg.ts');
 for(const [wall,bearing] of [['north',0],['east',90],['south',180],['west',270]]){
  const o=openings.createOpening('window-panoramic',wall),s=sun.sunDirection(lighting,bearing),p=openings.openingWorldTransform(shape,o),direction=new THREE.Vector3(s.x,s.y,s.z);
  near(direction.length(),1);assert.ok(s.x*Math.sin(p.rotation)+s.z*Math.cos(p.rotation)<0);
  const centre=new THREE.Vector3(p.x,o.sillHeight+o.height/2,p.z),floor=centre.clone().addScaledVector(direction,-centre.y/s.y);floor.y=.001;
  assert.ok(Math.abs(floor.x)<2&&Math.abs(floor.z)<2,'floor sunlight patch must lie inside the room');
  const g=createWallGeometry(4,2.7,.2,[{x:0,width:o.width,height:o.height,sillHeight:o.sillHeight}]),m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.position.set(p.x,1.35,p.z);m.rotation.y=p.rotation;m.updateMatrixWorld(true);
  assert.equal(new THREE.Raycaster(floor,direction).intersectObject(m).length,0,'the ray must pass through the real CSG opening');g.dispose();m.material.dispose();
 }
 assert.notEqual(sun.sunDirection({...lighting,timeOfDay:8}).azimuth,sun.sunDirection({...lighting,timeOfDay:18}).azimuth);
 assert.ok(sun.sunDirection({...lighting,timeOfDay:18}).elevation<sun.sunDirection(lighting).elevation);
 const manual=sun.sunDirection({...lighting,timeOfDay:13,sunAzimuth:450,sunElevation:99});near(manual.azimuth,90);near(manual.elevation,75);
});
test('auto sun ignores windows on shared walls and remains stable when selecting another room',()=>{
 const a={...room('a'),openings:[openings.createOpening('window-panoramic','east'),openings.createOpening('window-fixed','north')]},b={...room('b',4),openings:[openings.createOpening('window-casement','south')]};
 const connection=layout.defaultConnection(layout.roomContacts(a,b)[0],[a,b]),before=plan(a,[b],[connection]);
 assert.equal(sun.exteriorWindowBearing(before),180);assert.equal(sun.exteriorWindowBearing(rooms.activateDesignRoom(before,b.id)),180);
 assert.equal(sun.exteriorWindowBearing({...before,connections:[]}),90);
});
test('solar settings and new window types persist across rooms, undo/redo and JSON saves',()=>{
 const oldStorage=global.localStorage,oldWindow=global.window,saved=new Map();global.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};global.window={localStorage:global.localStorage};
 try{
  const {useDesigns:store}=loadSource('src/store/designs.ts');store.getState().createNew('40','Plan','living',shape);const a=store.getState().current.activeRoomId;
  store.getState().updateRoom({openings:[openings.createOpening('window-panoramic','north')],lighting:{...store.getState().current.lighting,sunAzimuth:90,sunElevation:32}});store.getState().addRoom('bedroom');
  assert.equal(store.getState().current.lighting.sunAzimuth,90);assert.ok(store.getState().current.rooms.every(r=>r.lighting.sunElevation===32));
  store.getState().updateRoom({lighting:{...store.getState().current.lighting,sunAzimuth:180}});store.getState().undo();assert.equal(store.getState().current.lighting.sunAzimuth,90);store.getState().redo();assert.equal(store.getState().current.lighting.sunAzimuth,180);
  store.getState().selectRoom(a);assert.equal(store.getState().current.openings[0].templateId,'window-panoramic');store.getState().saveCurrent();assert.equal(JSON.parse(saved.get('casa-designs-guest')).state.current.lighting.sunElevation,32);
  store.getState().updateRoom({lighting:{...store.getState().current.lighting,sunAzimuth:undefined,sunElevation:undefined}});const c=store.getState().current;assert.ok(c.rooms.every(r=>!('sunAzimuth' in r.lighting)));assert.deepEqual(JSON.parse(JSON.stringify(c)),c);
 }finally{global.localStorage=oldStorage;global.window=oldWindow;}
});
test('window inspector changes type without moving or resizing the opening and sun controls expose auto/manual modes',()=>{
 const react={...React,useState:v=>[v,()=>{}]},o=openings.createOpening('window-casement','north'),d=plan({...room('a'),openings:[o]});let changed,solarPatch;
 const {RoomEnvironmentPanel}=loadSource('src/components/RoomEnvironmentPanel.tsx',{react});
 const tree=RoomEnvironmentPanel({design:d,tab:'openings',surface:'floor',onSurfaceChange:()=>{},selectedWall:null,onSelectWall:()=>{},selectedOpening:o.id,onSelectOpening:()=>{},placementTemplate:null,onArmPlacement:()=>{},onAddOpening:()=>{},onUpdateOpening:v=>changed=v,onUpdate:()=>{},onHeight:()=>{},onNotice:()=>{},beginEdit:()=>{},endEdit:()=>{}});
 nodes(tree).find(n=>n.props?.['aria-label']==='Цонхны төрөл').props.onChange({target:{value:'window-triple'}});assert.equal(changed.templateId,'window-triple');near(changed.width,o.width);near(changed.position,o.position);assert.equal(changed.id,o.id);
 nodes(tree).find(n=>n.type==='button'&&React.Children.toArray(n.props.children).includes('Цонхыг нээх')).props.onClick();assert.equal(changed.open,true);
 const {RoomSunlightControls}=loadSource('src/features/room-planner/components/RoomSunlightControls.tsx');
 const props={lighting,windowBearing:90,onChange:p=>solarPatch=p,beginEdit:()=>{},endEdit:()=>{}},controls=nodes(RoomSunlightControls(props));
 controls.find(n=>n.type==='button'&&n.props.children==='Өөрөө тохируулах').props.onClick();near(solarPatch.sunAzimuth,108);
 const manual=nodes(RoomSunlightControls({...props,lighting:{...lighting,sunAzimuth:90,sunElevation:30}}));manual.find(n=>n.props?.['aria-label']==='Нарны өндөр').props.onChange({target:{value:'25'}});assert.equal(solarPatch.sunElevation,25);
 controls.find(n=>n.type==='button'&&n.props.children==='Цонхоор').props.onClick();assert.equal(solarPatch.sunAzimuth,undefined);
});
test('scene sunlight uses the chosen window direction and has zero direct intensity at night',()=>{
 const {RoomLighting}=loadSource('src/three/RoomStructure.tsx',{react:{...React,useMemo:fn=>fn(),useEffect:fn=>fn()},'@react-three/fiber':{useThree:select=>select({invalidate:()=>{}})}});
 const d={...room('a'),openings:[openings.createOpening('window-panoramic','east')]},day=nodes(RoomLighting({design:d,centre:[2,1],extent:10})).find(n=>n.type==='directionalLight'),direction=sun.sunDirection(lighting,90);
 near(day.props.position[0]-2,direction.x*18);near(day.props.position[2]-1,direction.z*18);assert.ok(day.props.intensity>0);
 assert.equal(nodes(RoomLighting({design:{...d,lighting:{...lighting,timeOfDay:21}}})).find(n=>n.type==='directionalLight').props.intensity,0);
});


test('closed window parts stay within the wall and clear a headboard on all four walls',()=>{
 const {ROOM_WALL_THICKNESS:t}=loadSource('src/lib/roomRendering.ts');
 const {RoomWindow}=loadSource('src/three/RoomWindow.tsx',{
  react:{...React,useRef:()=>({current:new THREE.Group()}),useEffect:()=>{}},
  '@react-three/drei':{RoundedBox:'rounded'},
  '@react-three/fiber':{useThree:select=>select({invalidate:()=>{}}),useFrame:()=>{}},
 });
 const objects=element=>{
  if(!element||typeof element!=='object')return null;
  if(typeof element.type==='function')return objects(element.type(element.props));
  if(element.type===React.Fragment){const group=new THREE.Group();React.Children.toArray(element.props.children).forEach(child=>{const object=objects(child);if(object)group.add(object);});return group;}
  if(!['mesh','group','rounded'].includes(element.type))return null;
  const children=React.Children.toArray(element.props.children);let geometry;
  if(element.type==='rounded')geometry=new THREE.BoxGeometry(...element.props.args);
  else if(element.type==='mesh'){
   const definition=children.find(child=>['boxGeometry','cylinderGeometry'].includes(child.type));
   if(definition)geometry=definition.type==='boxGeometry'?new THREE.BoxGeometry(...definition.props.args):new THREE.CylinderGeometry(...definition.props.args);
  }
  const object=geometry?new THREE.Mesh(geometry):new THREE.Group();
  if(element.props.position)object.position.fromArray(element.props.position);
  if(element.props.rotation)object.rotation.fromArray(element.props.rotation);
  children.forEach(child=>{const inner=objects(child);if(inner)object.add(inner);});return object;
 };
 for(const template of openings.OPENING_TEMPLATES.filter(option=>option.kind==='window')){
  const opening={...openings.createOpening(template.id,'north'),open:false},root=objects(RoomWindow({opening}));root.updateMatrixWorld(true);
  root.traverse(mesh=>{if(!mesh.isMesh)return;const box=new THREE.Box3().setFromObject(mesh);assert.ok(box.min.z>=-t-1e-6,template.id+' exceeds the outside wall face');assert.ok(box.max.z<=1e-6,template.id+' protrudes into the furnished room');});
  for(const wall of ['north','east','south','west']){
   const transform=openings.openingWorldTransform(shape,{...opening,wallId:wall}),world=new THREE.Group();world.position.set(transform.x,opening.sillHeight,transform.z);world.rotation.y=transform.rotation;world.add(root);world.updateMatrixWorld(true);
   const headboard=new THREE.Mesh(new THREE.BoxGeometry(opening.width+.3,1.3,.2));headboard.position.set(0,.65-opening.sillHeight,.02+.1);world.add(headboard);world.updateMatrixWorld(true);
   const bedBounds=new THREE.Box3().setFromObject(headboard);root.traverse(mesh=>{if(mesh.isMesh)assert.equal(new THREE.Box3().setFromObject(mesh).intersectsBox(bedBounds),false,template.id+' intersects headboard on '+wall);});
   world.remove(root);headboard.geometry.dispose();headboard.material.dispose();
  }
  root.traverse(mesh=>{if(mesh.isMesh){mesh.geometry.dispose();mesh.material.dispose();}});
 }
});
