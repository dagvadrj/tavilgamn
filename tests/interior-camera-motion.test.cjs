const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { dampInteriorLook, tourVerticalFov } = loadSource('src/lib/roomInteriorCamera.ts');
const initial = {x:.7,z:-.6,eyeHeight:1.6,yaw:.4,pitch:.2,fov:60};

test('90ms interior smoothing is independent of refresh rate and reaches an exact resting pose',()=>{
  const values=[];
  for(const fps of [30,60,120]){
    let pose={...initial};const goal={...pose,yaw:-.8,pitch:-.3};
    for(let i=0;i<fps*.3;i++)pose=dampInteriorLook(pose,goal,1/fps);
    values.push(pose);
    for(let i=0;i<fps*2;i++)pose=dampInteriorLook(pose,goal,1/fps);
    assert.deepEqual(pose,goal);
  }
  for(const p of values.slice(1)){
    assert.ok(Math.abs(p.yaw-values[0].yaw)<1e-12);
    assert.ok(Math.abs(p.pitch-values[0].pitch)<1e-12);
  }
});

function fixture(){
  const previousWindow=global.window,slots=[],listeners=new Map(),mediaListeners=new Map();
  let cursor=0,effects=[],frame;
  const effect=(fn,deps)=>{const at=cursor++,old=slots[at];if(!old||deps.some((v,i)=>!Object.is(v,old.deps[i]))){slots[at]={deps,cleanup:old?.cleanup};effects.push(()=>{old?.cleanup?.();slots[at].cleanup=fn();});}};
  const react={useRef:v=>slots[cursor++]??(slots[cursor-1]={current:v}),useEffect:effect,useLayoutEffect:effect};
  const media={matches:false,addEventListener:(n,fn)=>mediaListeners.set(n,fn),removeEventListener:n=>mediaListeners.delete(n)};
  global.window={matchMedia:()=>media};
  const canvas={style:{},tabIndex:-1,focus(){},setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){},
    addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)};
  const camera=new THREE.PerspectiveCamera(45,2),saved=[];
  const {RoomStreetView}=loadSource('src/three/RoomStreetView.tsx',{react,'@react-three/fiber':{useThree:()=>({camera,gl:{domElement:canvas},size:{width:1600,height:800},invalidate(){}}),useFrame:fn=>{frame=fn;}}});
  let props={pose:initial,roomId:'test',locked:false,room:{width:5,depth:4,pieces:[]},onSave:p=>saved.push({...p})};
  const render=patch=>{props={...props,...patch};cursor=0;effects=[];const tree=RoomStreetView(props);effects.forEach(e=>e());return tree;};
  render();
  return {camera,saved,render,frame:dt=>frame({},dt),media,reduce(){media.matches=true;mediaListeners.get('change')();},
    emit(n,patch={}){listeners.get(n)({pointerId:1,button:0,clientX:20,clientY:30,preventDefault(){},stopImmediatePropagation(){},...patch});},
    dispose(){slots.forEach(s=>s.cleanup?.());global.window=previousWindow;assert.equal(listeners.size,0);assert.equal(mediaListeners.size,0);}};
}

test('interior drag follows over frames, ignores old idle time, saves after settling and stops writing at rest',()=>{
  const f=fixture();try{
    const before=f.camera.quaternion.clone();
    f.emit('pointerdown');f.emit('pointermove',{clientX:140,clientY:80});
    assert.ok(f.camera.quaternion.angleTo(before)<1e-7);
    f.frame(12);assert.ok(f.camera.quaternion.angleTo(before)<1e-7);
    f.frame(1/60);assert.ok(f.camera.quaternion.angleTo(before)>.01);assert.equal(f.saved.length,0);
    f.emit('pointerup');assert.equal(f.saved.length,0);
    for(let i=0;i<120;i++)f.frame(1/60);
    assert.equal(f.saved.length,1);assert.ok(Math.abs(f.saved[0].yaw-(.4-120*.004))<1e-12);
    assert.equal(f.saved[0].pitch,0);assert.deepEqual(f.camera.position.toArray(),[.7,1.6,-.6]);
    const after=f.camera.quaternion.clone();for(let i=0;i<60;i++)f.frame(1/60);
    assert.equal(f.saved.length,1);assert.ok(f.camera.quaternion.angleTo(after)<1e-7);
  }finally{f.dispose();}
});

test('interior zoom accumulates wheel input over 280ms, reverses, and reduced motion finishes immediately',()=>{
  const f=fixture();try{
    f.emit('wheel',{deltaY:-30,deltaMode:0});f.emit('wheel',{deltaY:-30,deltaMode:0});
    assert.equal(f.camera.fov,tourVerticalFov(60,2));
    f.frame(.1);assert.ok(f.camera.fov<tourVerticalFov(60,2));
    for(let i=0;i<20;i++)f.frame(1/60);
    const expected=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.PI/6)*Math.exp(-.09)));
    assert.ok(Math.abs(f.saved.at(-1).fov-expected)<1e-10);
    f.emit('wheel',{deltaY:60,deltaMode:0});for(let i=0;i<20;i++)f.frame(1/60);
    assert.ok(Math.abs(f.saved.at(-1).fov-60)<1e-10);
    f.emit('pointerdown');f.emit('pointermove',{clientX:140});f.emit('pointerup');f.reduce();
    assert.ok(Math.abs(f.saved.at(-1).yaw+.08)<1e-10);
    f.render({request:{id:1,action:'zoom-in'}});
    assert.ok(f.saved.at(-1).fov<60);
  }finally{f.dispose();}
});

test('interior lock and external saved pose cancel outstanding movement',()=>{
  const f=fixture();try{
    f.emit('pointerdown');f.emit('pointermove',{clientX:140});f.frame(1/60);
    f.render({locked:true});const before=f.camera.quaternion.clone();f.frame(1/60);
    assert.equal(f.camera.quaternion.angleTo(before),0);
    f.render({locked:false,pose:{...initial,yaw:1.2,pitch:-.2}});
    for(let i=0;i<60;i++)f.frame(1/60);
    assert.ok(Math.abs(f.camera.rotation.y-1.2)<1e-10);assert.equal(f.saved.length,0);
  }finally{f.dispose();}
});

test('interior two-finger pinch zooms without rotating and ignores a remaining single finger',()=>{
  const f=fixture();try{
    const before=f.camera.quaternion.clone();
    f.emit('pointerdown',{pointerType:'touch',pointerId:1,clientX:100,clientY:100});
    f.emit('pointerdown',{pointerType:'touch',pointerId:2,clientX:200,clientY:100});
    f.emit('pointermove',{pointerType:'touch',pointerId:1,clientX:75,clientY:100});
    f.emit('pointermove',{pointerType:'touch',pointerId:2,clientX:225,clientY:100});
    f.emit('pointerup',{pointerType:'touch',pointerId:1});
    f.emit('pointermove',{pointerType:'touch',pointerId:2,clientX:400,clientY:250});
    f.emit('pointerup',{pointerType:'touch',pointerId:2});
    for(let i=0;i<30;i++)f.frame(1/60);
    const expected=THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(Math.PI/6)*100/150));
    assert.ok(Math.abs(f.saved.at(-1).fov-expected)<1e-10);
    assert.ok(f.camera.quaternion.angleTo(before)<1e-7);
  }finally{f.dispose();}
});

test('pointer cancellation stops outstanding look motion at the displayed pose',()=>{
  const f=fixture();try{
    f.emit('pointerdown');f.emit('pointermove',{clientX:140});f.frame(1/60);
    f.emit('pointercancel',{type:'pointercancel'});const before=f.camera.quaternion.clone();
    for(let i=0;i<60;i++)f.frame(1/60);
    assert.ok(f.camera.quaternion.angleTo(before)<1e-7);assert.equal(f.saved.length,1);
  }finally{f.dispose();}
});

test('reduced-motion rotation after a floor jump never restores the old camera location',()=>{
  const f=fixture();try{
    f.reduce();const tree=f.render({});assert.equal(tree.props.onJump({x:-.8,z:0}),true);
    f.render({request:{id:1,action:'rotate-left'}});
    assert.deepEqual(f.camera.position.toArray(),[-.8,1.6,0]);
  }finally{f.dispose();}
});
