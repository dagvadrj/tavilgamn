const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {loadSource}=require('./helpers/load-source.cjs');
const {getRoomMeasurements,formatRoomMeasurement}=loadSource('src/lib/roomMeasurements.ts');
const geometry=loadSource('src/lib/roomGeometry.ts');
const rooms=loadSource('src/lib/roomDesign.ts');
const layout=loadSource('src/lib/roomLayout.ts');
const room=(id,x,z,width,depth)=>({id,name:id,type:'living',position:{x,z},width,depth,height:2.7,wallColor:'#ffffff',floorColor:'#ccbbaa',pieces:[]});
const a=room('living',0,0,4.8,4.8),b=room('bedroom',5.75,0,4,3.5),all=[a,b];
const near=(a,b)=>assert.ok(Math.abs(a-b)<.000001,a+' != '+b);
const values=r=>Object.fromEntries(getRoomMeasurements(r,all).map(m=>[m.id,m.value]));
const length=m=>Math.hypot(...m.to.map((v,i)=>v-m.from[i]));
const nodes=n=>!n||typeof n!=='object'?[]:[n,...React.Children.toArray(n.props?.children).flatMap(nodes)];
const plan=()=>rooms.syncDesignRooms({...a,id:'plan',name:'Plan',size:'40',activeRoomId:a.id,roomName:a.name,roomType:a.type,rooms:all,createdAt:1,updatedAt:1});

test('dimensions use each interior room, excluding the 10.15 m layout span and space between rooms',()=>{
 const bounds=layout.layoutBounds(all);near(bounds.maxX-bounds.minX,10.15);
 assert.deepEqual(values(a),{width:4.8,depth:4.8});assert.deepEqual(values(b),{width:4,depth:3.5});
 for(const r of all)for(const m of getRoomMeasurements(r,all)){near(length(m),m.value);near(Math.hypot(m.wallTo[0]-m.wallFrom[0],m.wallTo[2]-m.wallFrom[2]),m.value);}
});
test('shared-side dimensions choose a free exterior side for adjacent and stacked rooms',()=>{
 const left=room('left',0,0,4,4),right=room('right',4,0,4,3.5),pair=[left,right];
 assert.ok(getRoomMeasurements(left,pair).find(m=>m.id==='depth').from[0]<-2);
 assert.ok(getRoomMeasurements(right,pair).find(m=>m.id==='depth').from[0]>2);
 const upper=room('upper',0,-4,4,4),stack=[left,upper];
 assert.ok(getRoomMeasurements(left,stack).find(m=>m.id==='width').from[2]>2);
 assert.ok(getRoomMeasurements(upper,stack).find(m=>m.id==='width').from[2]<-2);
});
test('moving or separating rooms changes label positions but never their measured lengths',()=>{
 for(const position of [{x:4,z:0},{x:12,z:7},{x:-6,z:-10}]){
  const other={...b,position},pair=[a,other];
  assert.deepEqual(getRoomMeasurements(a,pair).map(m=>m.value),[4.8,4.8]);assert.deepEqual(getRoomMeasurements(other,pair).map(m=>m.value),[4,3.5]);
 }
});
test('notches and recesses measure actual finite wall segments and ignore internal column faces',()=>{
 const complex={...a,wallFeatures:[{id:'inset',kind:'inset',wall:'north',offset:1,length:1.2,depth:.5},{id:'recess',kind:'recess',wall:'east',offset:1,length:1.4,depth:.6}],columns:[{id:'column',x:3,z:3,width:.3,depth:.4}]};
 const g=geometry.getRoomGeometry(complex),measurements=getRoomMeasurements(complex);
 assert.equal(measurements.length,g.segments.filter(s=>!s.hole).length);assert.ok(measurements.some(m=>Math.abs(m.value-.5)<.000001));assert.ok(measurements.some(m=>Math.abs(m.value-.6)<.000001));
 for(const m of measurements){near(length(m),m.value);assert.ok(g.segments.some(s=>Math.abs(s.a.x-m.wallFrom[0])<.000001&&Math.abs(s.a.z-m.wallFrom[2])<.000001&&Math.abs(s.b.x-m.wallTo[0])<.000001&&Math.abs(s.b.z-m.wallTo[2])<.000001));}
});
test('room dimensions retain millimetre precision and resize with the measured floor',()=>{
 const r=room('exact',0,0,4.197,2.737),measurements=getRoomMeasurements(r);assert.deepEqual(measurements.map(m=>formatRoomMeasurement(m.value)),['4.197 м','2.737 м']);
 assert.equal(formatRoomMeasurement(4.8),'4.80 м');assert.equal(formatRoomMeasurement(1.99999999),'2.00 м');assert.equal(getRoomMeasurements({...r,width:5.123})[0].value,5.123);
});
test('real canvas renders separate measurements at each room origin and keeps them fixed across selection',()=>{
 const react={...React,useState:v=>[v,()=>{}],useRef:v=>({current:v}),useEffect:()=>{},useMemo:fn=>fn()};
 const {RoomCanvas}=loadSource('src/three/RoomCanvas.tsx',{react,'@react-three/fiber':{Canvas:'canvas'},'@react-three/drei':new Proxy({},{get:(_,key)=>String(key)})});
 const props={selected:null,onSelect:()=>{},onMove:()=>{},view:'perspective',snapEnabled:true,locked:false,showDimensions:true},before=plan(),after=rooms.activateDesignRoom(before,b.id);
 const worldLines=d=>{
  const tree=RoomCanvas({...props,design:d}),groups=nodes(tree).filter(n=>n.type==='group'&&n.key?.includes('dimensions-')),active=d.rooms.find(r=>r.id===d.activeRoomId),result={};
  assert.equal(groups.length,2);
  for(const group of groups){const dimension=React.Children.toArray(group.props.children)[0];assert.equal(dimension.type.name,'RoomDimensions');const r=dimension.props.room;result[r.id]=getRoomMeasurements(r,dimension.props.neighbours).map(m=>({value:m.value,from:[m.from[0]+group.props.position[0]+active.position.x,m.from[1],m.from[2]+group.props.position[2]+active.position.z],to:[m.to[0]+group.props.position[0]+active.position.x,m.to[1],m.to[2]+group.props.position[2]+active.position.z]}));}
  return result;
 };
 const oldLines=worldLines(before),newLines=worldLines(after);assert.deepEqual(Object.keys(oldLines),Object.keys(newLines));for(const id of Object.keys(oldLines)){assert.equal(oldLines[id].length,newLines[id].length);oldLines[id].forEach((line,i)=>{near(line.value,newLines[id][i].value);for(const endpoint of ['from','to'])line[endpoint].forEach((value,axis)=>near(value,newLines[id][i][endpoint][axis]));});}assert.equal(nodes(RoomCanvas({...props,design:before,showDimensions:false})).filter(n=>n.type?.name==='RoomDimensions').length,0);
 const activeNodes=nodes(RoomCanvas({...props,design:after})).filter(n=>n.type?.name==='RoomDimensions');assert.equal(activeNodes.find(n=>n.props.active).props.room.id,b.id);
});
test('dimension overlay draws the stated length and labels it with its owner room',()=>{
 const {RoomDimensions}=loadSource('src/three/RoomDimensions.tsx',{'@react-three/drei':{Line:'line',Html:'html'}});
 const rendered=nodes(RoomDimensions({room:b,neighbours:all,name:'Унтлагын өрөө',active:true}));
 assert.deepEqual(rendered.filter(n=>n.type==='span').map(n=>n.props.children),['4.00 м','3.50 м']);assert.ok(rendered.filter(n=>n.type==='span').every(n=>n.props['aria-label'].includes('Унтлагын өрөө')));
 assert.ok(rendered.filter(n=>n.type==='line').every(n=>n.props.depthTest===false));
});
