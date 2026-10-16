const test=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadSource}=require('./helpers/load-source.cjs');
const {roomOutline,roomWithOutline,roomContainsFootprint,validateRoomOutline,wallPoint,wallSamples,splitRoomWall,roomBoundary,roomOutlinePath}=loadSource('src/lib/kitchenRoomOutline.ts');
const {parseKitchenSpace,resizeKitchenRoom}=loadSource('src/lib/kitchenSpace.ts');
const {roomWalls}=loadSource('src/lib/kitchenCabinets.ts');
const {createUnifiedKitchen,parseKitchen}=loadSource('src/lib/kitchenAssembly.ts');
const {placementIssues}=loadSource('src/lib/kitchenPlacement.ts');
const {kitchenWallPanels}=loadSource('src/lib/kitchenWallPanels.ts');
const {Plan}=loadSource('src/features/kitchen-planner/components/PlannerPanels.tsx');
const room={width:4000,depth:3000,height:2600};
const subdivided=()=>{const points=roomOutline(room);points.splice(1,0,{x:2000,z:0,wall:'back'});return points;};

test('inserting a point keeps wall support, openings, furniture dimensions and saved geometry',()=>{
  const kitchen=createUnifiedKitchen();
  const before=JSON.stringify(kitchen.cabinets);
  kitchen.room=roomWithOutline(kitchen.room,subdivided());
  assert.equal(roomWalls(kitchen.room).length,4);
  assert.equal(placementIssues(kitchen).filter(i=>i.severity==='error').length,0);
  const saved=parseKitchen(JSON.parse(JSON.stringify(kitchen)));
  assert.deepEqual(saved.room.outline,kitchen.room.outline);
  assert.deepEqual(JSON.parse(JSON.stringify(saved.cabinets)),JSON.parse(before));
  const windowRoom={...kitchen.room,items:[{id:'window',kind:'window',wall:'back',x:2000,z:0,width:1200,depth:100}]};
  assert.equal(parseKitchenSpace(windowRoom).items.length,1);
  assert.equal(roomWalls(windowRoom).flatMap(w=>kitchenWallPanels(w,windowRoom).openings).length,1);
});

test('moving a midpoint creates angled walls and rejects furniture outside the new boundary',()=>{
  const points=subdivided();points[1].z=1200;
  const next=roomWithOutline(room,points);
  assert.equal(roomWalls(next).length,5);
  assert.ok(roomWalls(next).some(w=>w.inward.x!==0 && w.inward.z!==0));
  const kitchen={...createUnifiedKitchen(),room:next};
  assert.ok(placementIssues(kitchen).some(i=>i.code==='outside'));
  assert.equal(roomContainsFootprint(next,[{x:1800,z:100},{x:2200,z:100},{x:2200,z:600},{x:1800,z:600}]),false);
});

test('concave notches are detected even when every furniture corner is inside',()=>{
  const outline=[[0,0],[4000,0],[4000,3000],[2500,3000],[2500,1200],[1500,1200],[1500,3000],[0,3000]].map(([x,z])=>({x,z,wall:'front'}));
  const next=roomWithOutline(room,outline);
  assert.equal(roomContainsFootprint(next,[{x:1000,z:1000},{x:3000,z:1000},{x:3000,z:2000},{x:1000,z:2000}]),false);
  assert.equal(roomContainsFootprint(next,[{x:0,z:0},{x:1000,z:0},{x:1000,z:1000},{x:0,z:1000}]),true);
});

test('malformed, crossed, tiny or overlapping room boundaries cannot be saved',()=>{
  const points=roomOutline(room);
  assert.throws(()=>validateRoomOutline({...room,outline:[points[0],points[2],points[1],points[3]]}));
  assert.throws(()=>validateRoomOutline({...room,outline:[...points,{...points[0]}]}));
  assert.throws(()=>validateRoomOutline({...room,outline:points.map((p,i)=>i===1?{...p,x:Infinity}:p)}));
  assert.throws(()=>validateRoomOutline({...room,outline:Array(41).fill(points[0])}));
  assert.throws(()=>parseKitchenSpace({...room,outline:[{x:0,z:0,wall:'back'},{x:20,z:0,wall:'right'},{x:20,z:20,wall:'front'}]}));
});

test('numeric room resizing scales the outline without changing furniture sizes',()=>{
  const next=resizeKitchenRoom(roomWithOutline(room,subdivided()),{width:6000,depth:4500});
  assert.deepEqual(next.outline[1],{x:3000,z:0,wall:'back'});
  assert.deepEqual(next.outline[3],{x:6000,z:4500,wall:'front'});
});

test('resizing preserves openings on an inset wall rather than moving them to the bounding box',()=>{
  const outline=[[0,0,'back'],[4000,0,'right'],[4000,3000,'front'],[2500,3000,'right'],[2500,2000,'front'],[0,2000,'left']].map(([x,z,wall])=>({x,z,wall}));
  const base={...roomWithOutline(room,outline),items:[{id:'window',kind:'window',wall:'front',x:1000,z:2000,width:900,depth:100}]};
  const next=resizeKitchenRoom(base,{width:6000,depth:4500});
  assert.equal(next.items[0].x,1500);assert.equal(next.items[0].z,3000);
  assert.equal(parseKitchenSpace(next).items.length,1);
});

test('room drafting exposes points and midpoints separately from the furniture plan',()=>{
  const props={kitchen:createUnifiedKitchen(),selectedId:null,onSelect(){},onRoomChange(){}};
  const {KitchenRoomDraft}=loadSource('src/features/kitchen-planner/components/KitchenRoomDraft.tsx');
  const html=renderToStaticMarkup(React.createElement(KitchenRoomDraft,{room:props.kitchen.room,wall:null,selectedItem:null,disabled:false,onWall(){},onItem(){},onClear(){},onRoomChange(){}}));
  assert.equal((html.match(/data-room-point=/g)||[]).length,4);
  assert.equal((html.match(/data-room-midpoint=/g)||[]).length,4);
  assert.equal((html.match(/data-room-curve=/g)||[]).length,4);
  assert.doesNotMatch(html,/data-resize-handle|km-plan-resize/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Plan,props)),/data-room-point/);
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Plan,{...props,readOnly:true})),/data-room-point/);
});

test('curved walls survive saving, render as curves and produce matching 3D wall segments',()=>{
  const kitchen=createUnifiedKitchen(),points=roomOutline(kitchen.room);
  points[2].curve={x:2000,z:1800};
  kitchen.room=roomWithOutline(kitchen.room,points);
  const saved=parseKitchen(JSON.parse(JSON.stringify(kitchen)));
  assert.deepEqual(saved.room.outline[2].curve,{x:2000,z:1800});
  assert.match(roomOutlinePath(saved.room.outline),/Q2000 1800 0 3000/);
  const walls=roomWalls(saved.room).filter(w=>w.sourceWall==='front');
  assert.ok(walls.length>=16);
  assert.ok(walls.some(w=>w.start.z<2500));
  const boundary=roomBoundary(saved.room);
  assert.ok(boundary.some(p=>p.x===2000 && p.z===2400));
  assert.equal(roomContainsFootprint(saved.room,[{x:1800,z:2500},{x:2200,z:2500},{x:2200,z:2800},{x:1800,z:2800}]),false);
  const scaled=resizeKitchenRoom(saved.room,{width:6000,depth:4500});
  assert.deepEqual(scaled.outline[2].curve,{x:3000,z:2700});
});

test('adding a midpoint preserves the entire quadratic curve instead of straightening it',()=>{
  const points=roomOutline(room);points[2].curve={x:2400,z:1500};
  const split=splitRoomWall(points,2);
  assert.equal(split.length,5);
  for(let i=0;i<=20;i++) {
    const t=i/20,original=wallPoint(points[2],points[3],t);
    const after=t<=0.5?wallPoint(split[2],split[3],t*2):wallPoint(split[3],split[4],(t-0.5)*2);
    assert.ok(Math.hypot(original.x-after.x,original.z-after.z)<0.000001);
  }
  assert.doesNotThrow(()=>roomWithOutline(room,split));
  assert.ok(wallSamples(points[2],points[3]).length>16);
});

test('invalid curve controls and curved self-intersections are rejected',()=>{
  const points=roomOutline(room);points[2].curve={x:NaN,z:1000};
  assert.throws(()=>validateRoomOutline({...room,outline:points}));
  points[2].curve={x:9000,z:1000};
  assert.throws(()=>validateRoomOutline({...room,outline:points}));
  const crossing=[{x:1000,z:1000,wall:'back',curve:{x:3000,z:5000}},{x:4000,z:1000,wall:'right'},{x:4000,z:2500,wall:'front'},{x:1000,z:2500,wall:'left'}];
  assert.throws(()=>roomWithOutline(room,crossing));
});

test('point gestures insert, drag at a frozen scale, commit once and cancel without changing the room',t=>{
  const previous=global.window, listeners=new Map(), cleanups=[];
  global.window={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  t.after(()=>{cleanups.forEach(fn=>fn?.());global.window=previous;});
  const changes=[];
  const {KitchenRoomOutlineEditor}=loadSource('src/features/kitchen-planner/components/KitchenRoomOutlineEditor.tsx',{
    react:{...React,useRef:v=>({current:v}),useState:v=>[v,()=>{}],useEffect:cb=>cleanups.push(cb())},
  });
  const tree=KitchenRoomOutlineEditor({room,onChange:next=>changes.push(next)});
  const nodes=n=>!React.isValidElement(n)?[]:[n,...React.Children.toArray(n.props.children).flatMap(nodes)];
  const midpoint=nodes(tree).find(n=>n.props['data-room-midpoint']===2);
  let scale=2,captured=false;
  const svg={getScreenCTM:()=>({inverse:()=>({scale})}),createSVGPoint:()=>({x:0,y:0,matrixTransform(m){return{x:this.x*m.scale,y:this.y*m.scale};}})};
  const target={ownerSVGElement:svg,setPointerCapture(){captured=true;},hasPointerCapture:()=>captured,releasePointerCapture(){captured=false;}};
  const event={button:0,pointerId:1,clientX:1000,clientY:1500,currentTarget:target,stopPropagation(){},preventDefault(){}};
  midpoint.props.onPointerDown(event);
  assert.equal(changes.length,0);assert.equal(captured,true);
  scale=10;
  tree.props.onPointerMove({...event,clientY:1650});
  tree.props.onPointerUp({...event,clientY:1700});
  assert.equal(changes.length,1);assert.equal(changes[0].outline.length,5);
  assert.equal(changes[0].outline[3].z,3400);assert.equal(changes[0].depth,3400);
  assert.equal(captured,false);
  midpoint.props.onClick({stopPropagation(){}});assert.equal(changes.length,1);
  for(const cancel of [()=>tree.props.onPointerCancel(event),()=>listeners.get('keydown')({key:'Escape',preventDefault(){}}),()=>listeners.get('blur')(),()=>tree.props.onLostPointerCapture()]) {
    midpoint.props.onPointerDown(event);tree.props.onPointerMove({...event,clientY:2000});cancel();
    assert.equal(changes.length,1);assert.equal(captured,false);
  }
  assert.equal(room.outline,undefined);
  scale=2;
  const curve=nodes(tree).find(n=>n.props['data-room-curve']===2);
  curve.props.onPointerDown({...event,clientY:1420});
  tree.props.onPointerUp({...event,clientY:1000});
  assert.equal(changes.length,2);
  assert.deepEqual(changes[1].outline[2].curve,{x:2000,z:2000});
  curve.props.onKeyDown({key:'Delete',shiftKey:false,preventDefault(){},stopPropagation(){}});
  assert.equal(changes.length,3);
  assert.equal(changes[2].outline[2].curve,undefined);
});
