const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
function hooks() {
 const slots=[]; let cursor=0, pending=[], dirty=false;
 const state=(initial)=>{const at=cursor++;if(!slots[at]){slots[at]={value:typeof initial==='function'?initial():initial};slots[at].set=value=>{const next=typeof value==='function'?value(slots[at].value):value;if(!Object.is(slots[at].value,next)){slots[at].value=next;dirty=true;}};}return [slots[at].value,slots[at].set];};
 const effect=(fn,deps)=>{const at=cursor++,old=slots[at];if(!old||!deps||deps.some((v,i)=>!Object.is(v,old.deps?.[i]))){slots[at]={deps,cleanup:old?.cleanup};pending.push(()=>{old?.cleanup?.();slots[at].cleanup=fn();});}};
 return {react:{...React,useState:state,useRef:value=>{const at=cursor++;return slots[at]??(slots[at]={current:value});},useMemo:fn=>fn(),useCallback:fn=>fn,useEffect:effect,useLayoutEffect:effect},render(fn){let tree;for(let i=0;i<15;i++){cursor=0;pending=[];dirty=false;tree=fn();const work=pending;pending=[];work.forEach(fn=>fn());if(!dirty)return tree;}throw Error('render did not settle');}};
}
function rigHarness(withControls=true) {
 const h=hooks(),camera=new THREE.PerspectiveCamera(40,1.6,.1,300);let invalidations=0;
 const state={camera,size:{width:960,height:600},invalidate:()=>invalidations++};
 const attach=()=>state.controls={target:new THREE.Vector3(),update(){camera.lookAt(this.target);camera.updateMatrixWorld();}};
 if(withControls)attach();
 const {RoomCameraRig}=loadSource('src/three/RoomCameraRig.tsx',{react:h.react,'@react-three/fiber':{useThree:select=>select(state)}});
 const props={view:'perspective',width:8,depth:4,height:2.7,centerX:2,centerZ:0,resetKey:1,originX:0,originZ:0};
 return {state,camera,attach,props,render:(patch={})=>h.render(()=>RoomCameraRig({...props,...patch})),invalidations:()=>invalidations};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);
const vectorNear=(a,b)=>a.toArray().forEach((v,i)=>near(v,b.toArray()[i]));
function customize(h,plan=false) {
 h.camera.zoom=1.7;h.camera.position.set(10,plan?12:7,13);h.state.controls.target.set(2,plan?0:1.2,-1);
 h.camera.up.set(0,plan?0:1,plan?-1:0);h.state.controls.update();h.camera.updateProjectionMatrix();
}
test('switching room coordinates preserves world framing, pan, zoom and orbit angle over repeated selections',()=>{
 const h=rigHarness();h.render();customize(h);
 const position=h.camera.position.clone(),target=h.state.controls.target.clone(),quaternion=h.camera.quaternion.clone();
 const points=[new THREE.Vector3(-1,0,-1),new THREE.Vector3(5,2,1)],screen=points.map(p=>p.clone().project(h.camera));
 for(let i=0;i<12;i++)for(const origin of [{x:4,z:0},{x:-5,z:6},{x:0,z:0}]){
  h.render({originX:origin.x,originZ:origin.z,centerX:2-origin.x,centerZ:-origin.z});
  vectorNear(h.camera.position.clone().add(new THREE.Vector3(origin.x,0,origin.z)),position);
  vectorNear(h.state.controls.target.clone().add(new THREE.Vector3(origin.x,0,origin.z)),target);
  near(h.camera.zoom,1.7);near(h.camera.quaternion.angleTo(quaternion),0);
  points.forEach((p,index)=>vectorNear(p.clone().sub(new THREE.Vector3(origin.x,0,origin.z)).project(h.camera),screen[index]));
 }
 assert.ok(h.invalidations()>30);
});
test('plan camera orientation and user zoom survive room selection and sidebar resize',()=>{
 const h=rigHarness();h.render({view:'plan'});customize(h,true);const p=h.camera.position.clone(),q=h.camera.quaternion.clone();
 h.render({view:'plan',originX:4,originZ:3,centerX:-2,centerZ:-3});
 vectorNear(h.camera.position,p.clone().sub(new THREE.Vector3(4,0,3)));near(h.camera.quaternion.angleTo(q),0);near(h.camera.zoom,1.7);
 const moved=h.camera.position.clone();h.state.size={width:650,height:600};h.render({view:'plan',originX:4,originZ:3,centerX:-2,centerZ:-3});vectorNear(h.camera.position,moved);near(h.camera.zoom,1.7);
});
test('late-mounted orbit controls inherit the fitted target rather than pointing at zero',()=>{
 const h=rigHarness(false);h.render();const position=h.camera.position.clone(),q=h.camera.quaternion.clone();h.attach();h.render();
 vectorNear(h.state.controls.target,new THREE.Vector3(2,1.08,0));vectorNear(h.camera.position,position);near(h.camera.quaternion.angleTo(q),0);
});
test('room/layout edits retain a user camera pose and explicit reset still fits the scene',()=>{
 const h=rigHarness();h.render();customize(h);const p=h.camera.position.clone();h.render({width:12,depth:7,height:3,centerX:4,centerZ:2});vectorNear(h.camera.position,p);
 h.render({width:12,depth:7,height:3,centerX:4,centerZ:2,resetKey:2});assert.ok(h.camera.position.distanceTo(p)>1);vectorNear(h.state.controls.target,new THREE.Vector3(4,1.2,2));
});
function nodes(tree){return !tree||typeof tree!=='object'?[]:[tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];}
test('real planner map and scene selection keep one canvas key, current view and reset generation',()=>{
 const oldStorage=global.localStorage,oldWindow=global.window,saved=new Map();global.localStorage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 global.window={localStorage:global.localStorage,location:{search:''},addEventListener(){},removeEventListener(){},setTimeout,clearTimeout};
 try{
  const {useDesigns:store}=loadSource('src/store/designs.ts');store.getState().createNew('40','Plan','living',{width:4,depth:4,height:2.7});const a=store.getState().current.activeRoomId;store.getState().addRoom('bedroom');const b=store.getState().current.activeRoomId;
  const h=hooks();
  const {RoomPlanner}=loadSource('src/components/RoomPlanner.tsx',{
   react:h.react,'next/dynamic':{default:()=> 'room-canvas'},'next/image':{default:'image'},'next/link':{default:'link'},
   '@/store/designs':{...loadSource('src/store/designs.ts'),useDesigns:Object.assign(()=>store.getState(),{getState:store.getState})},
   '@/store/catalog':{getProduct:()=>undefined,useCatalog:()=>({products:[],ready:true,loading:false})},
   '@/store/kitchens':{useKitchens:()=>({items:[]})},'@/store/auth':{useAuth:select=>select({user:null})},'@/store/cart':{useCart:select=>select({add:()=>{}})},
   '@/features/room-planner/components/RoomPlannerStart':{RoomPlannerStart:'room-start'},
   '@/features/room-planner/components/PlannerPanels':{Drawer:'drawer',CompareModal:'compare',NumberControl:'number',PlannerSkeleton:'skeleton'},
   '@/features/room-planner/components/RoomPlannerControls':{RoomPlannerControls:'room-controls'},
   './RoomPlacementMap':{RoomPlacementMap:'room-map'},
  });
  const render=()=>h.render(()=>RoomPlanner()),find=(t,type)=>nodes(t).find(n=>n.type===type);
  find(render(),'room-start').props.onResume();let tree=render();find(tree,'room-controls').props.onView('top');tree=render();const canvas=find(tree,'room-canvas');assert.equal(canvas.props.view,'plan');
  for(let i=0;i<8;i++){
   find(tree,'room-map').props.onSelect(i%2?a:b);tree=render();const next=find(tree,'room-canvas');assert.equal(next.key,canvas.key);assert.equal(next.props.resetKey,canvas.props.resetKey);assert.equal(next.props.view,'plan');assert.equal(next.props.design.activeRoomId,i%2?a:b);
   next.props.onSelectRoom(i%2?b:a);tree=render();assert.equal(find(tree,'room-canvas').key,canvas.key);assert.equal(find(tree,'room-canvas').props.view,'plan');
  }
  // Releasing furniture in the neighbour changes ownership while keeping selection/view.
  store.getState().selectRoom(a);assert.equal(store.getState().moveRoom(b,{x:4,z:0},false),null);
  const bed={instanceId:'moving-bed',productId:'unknown-bed',x:0,z:0,rotation:0,color:'cream',material:'fabric'};
  store.getState().updatePieces([bed]);tree=render();let moving=find(tree,'room-canvas');moving.props.onSelect(bed.instanceId);tree=render();moving=find(tree,'room-canvas');assert.equal(moving.props.selected,bed.instanceId);
  const reset=moving.props.resetKey;moving.props.onEditStart();moving.props.onMove(bed.instanceId,4,0);tree=render();moving=find(tree,'room-canvas');assert.equal(moving.props.design.activeRoomId,a);
  moving.props.onEditEnd();tree=render();moving=find(tree,'room-canvas');assert.equal(moving.props.design.activeRoomId,b);assert.equal(moving.props.selected,bed.instanceId);assert.equal(moving.props.design.pieces[0].x,0);assert.equal(moving.key,canvas.key);assert.equal(moving.props.resetKey,reset);assert.equal(moving.props.view,'plan');
  store.getState().undo();tree=render();moving=find(tree,'room-canvas');assert.equal(moving.props.design.activeRoomId,a);assert.equal(moving.props.selected,bed.instanceId);assert.equal(moving.props.design.pieces[0].x,0);
  store.getState().redo();tree=render();moving=find(tree,'room-canvas');assert.equal(moving.props.design.activeRoomId,b);assert.equal(moving.props.selected,bed.instanceId);assert.equal(moving.props.resetKey,reset);
 }finally{global.localStorage=oldStorage;global.window=oldWindow;}
});
