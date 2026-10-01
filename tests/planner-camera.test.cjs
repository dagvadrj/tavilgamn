const {test}=require('node:test');
const assert=require('node:assert/strict');
const {PerspectiveCamera,Vector3}=require('three');
const {loadSource}=require('./helpers/load-source.cjs');
const {navigateCamera,bindBlenderMouse}=loadSource('src/lib/plannerCamera.ts');
const {OrbitControls,MapControls}=require('three-stdlib');
const bounds={width:5,depth:4,height:2.7,centerX:1,centerZ:-1};
function fixture() {
  const camera=new PerspectiveCamera(40,1.4,.1,300);
  const target=new Vector3(1,1,-1);
  camera.position.copy(target).add(new Vector3(5,4,6));camera.lookAt(target);
  let updates=0;
  const controls={target,minDistance:.8,maxDistance:100,update:()=>updates++};
  const apply=(action,plan=false,aspect=1.4)=>navigateCamera(camera,controls,action,bounds,aspect,plan);
  return {camera,controls,apply,get updates(){return updates;}};
}
test('map zoom is reversible, bounded and does not move the target',()=>{
  const f=fixture(), position=f.camera.position.clone(), target=f.controls.target.clone();
  f.apply('zoom-in');assert.ok(f.camera.position.distanceTo(target)<position.distanceTo(target));
  f.apply('zoom-out');assert.ok(f.camera.position.distanceTo(position)<1e-8);
  for(let i=0;i<100;i++)f.apply('zoom-in');
  assert.ok(Math.abs(f.camera.position.distanceTo(target)-.8)<1e-8);
  for(let i=0;i<100;i++)f.apply('zoom-out');
  assert.ok(Math.abs(f.camera.position.distanceTo(target)-100)<1e-8);
  assert.deepEqual(f.controls.target.toArray(),target.toArray());assert.ok(f.updates>0);
});
test('map pan moves camera and target together on the floor, retaining orbit distance',()=>{
  for(const action of ['pan-left','pan-right','pan-up','pan-down']){
    const f=fixture(), p=f.camera.position.clone(),t=f.controls.target.clone(),d=p.distanceTo(t);
    f.apply(action);
    assert.ok(f.controls.target.distanceTo(t)>.01);
    assert.equal(f.camera.position.y,p.y);assert.equal(f.controls.target.y,t.y);
    assert.ok(f.camera.position.clone().sub(p).distanceTo(f.controls.target.clone().sub(t))<1e-8);
    assert.ok(Math.abs(f.camera.position.distanceTo(f.controls.target)-d)<1e-8);
  }
});
test('map rotate retains distance and elevation; planar view ignores rotation',()=>{
  const f=fixture(),p=f.camera.position.clone(),d=p.distanceTo(f.controls.target);
  f.apply('rotate-left');assert.ok(f.camera.position.distanceTo(p)>1);assert.equal(f.camera.position.y,p.y);
  assert.ok(Math.abs(f.camera.position.distanceTo(f.controls.target)-d)<1e-8);
  f.apply('rotate-right');assert.ok(f.camera.position.distanceTo(p)<1e-8);
  f.apply('rotate-left',true);assert.ok(f.camera.position.distanceTo(p)<1e-8);
});
test('fit respects current room centre and narrow viewport; top/front have correct directions',()=>{
  const f=fixture();f.apply('fit');const wide=f.camera.position.distanceTo(f.controls.target);
  f.apply('fit',false,.5);assert.ok(f.camera.position.distanceTo(f.controls.target)>wide);
  assert.equal(f.controls.target.x,bounds.centerX);assert.equal(f.controls.target.z,bounds.centerZ);
  f.apply('top',true);assert.deepEqual(f.camera.up.toArray(),[0,0,-1]);assert.equal(f.controls.target.y,0);
  assert.ok(f.camera.position.y>4);assert.ok(Math.abs(f.camera.position.x-bounds.centerX)<1e-8);
  f.apply('front');assert.deepEqual(f.camera.up.toArray(),[0,1,0]);
  assert.equal(f.camera.position.x,bounds.centerX);assert.ok(f.camera.position.z>bounds.centerZ);
});
test('camera commands never mutate input dimensions and stay finite with a zero offset',()=>{
  const frozen=Object.freeze({...bounds}),f=fixture();f.camera.position.copy(f.controls.target);
  navigateCamera(f.camera,f.controls,'zoom-in',frozen,1);
  assert.ok(f.camera.position.toArray().every(Number.isFinite));
  assert.deepEqual(frozen,bounds);
});

// Exercise the installed controls implementation without a browser/WebGL context.
class Surface {
  constructor(){this.handlers=new Map();this.style={};this.clientWidth=800;this.clientHeight=600;}
  addEventListener(type,fn,capture=false){const items=this.handlers.get(type)||[];items.push({fn,capture});this.handlers.set(type,items);}
  removeEventListener(type,fn){this.handlers.set(type,(this.handlers.get(type)||[]).filter(x=>x.fn!==fn));}
  emit(type,event){for(const x of [...(this.handlers.get(type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture)))x.fn(event);}
  releasePointerCapture(){}
}
function mouseFixture(plan=false){
  const camera=new PerspectiveCamera(40,4/3,.1,300);camera.position.set(5,4,6);
  const element=new Surface();element.ownerDocument=new Surface();
  const controls=new (plan?MapControls:OrbitControls)(camera,element);
  controls.enableRotate=!plan;controls.update();
  const touches={...controls.touches},previous={...controls.mouseButtons};
  const cleanup=bindBlenderMouse(controls,element,plan);
  const event=(button,x,y,modifiers={})=>({button,pointerId:1,pointerType:'mouse',clientX:x,clientY:y,pageX:x,pageY:y,
    shiftKey:false,ctrlKey:false,metaKey:false,preventDefault(){},...modifiers});
  const drag=(button,modifiers={})=>{
    element.emit('pointerdown',event(button,100,100,modifiers));
    element.ownerDocument.emit('pointermove',event(button,180,140,modifiers));
    element.ownerDocument.emit('pointerup',event(button,180,140,modifiers));
  };
  return {camera,controls,element,drag,cleanup,touches,previous};
}
test('Blender middle drag rotates; left drag does not orbit or compete with object movement',()=>{
  const f=mouseFixture(),p=f.camera.position.clone();f.drag(0);assert.ok(f.camera.position.distanceTo(p)<1e-8);
  f.drag(1);assert.ok(f.camera.position.distanceTo(p)>.1);assert.ok(f.controls.target.length()<1e-8);
  f.cleanup();f.controls.dispose();
});
test('Blender Shift + middle drag pans rather than rotating',()=>{
  const f=mouseFixture(),before=f.camera.position.clone().sub(f.controls.target);
  f.drag(1,{shiftKey:true});assert.ok(f.controls.target.length()>.1);
  assert.ok(f.camera.position.clone().sub(f.controls.target).distanceTo(before)<1e-8);
  f.cleanup();f.controls.dispose();
});
test('Blender Ctrl + middle drag zooms and rolling the wheel still zooms',()=>{
  const f=mouseFixture(),distance=f.controls.getDistance();f.drag(1,{ctrlKey:true});
  assert.notEqual(f.controls.getDistance(),distance);
  const previous=f.controls.getDistance();
  f.element.emit('wheel',{deltaY:-100,preventDefault(){},stopPropagation(){}});
  assert.ok(f.controls.getDistance()<previous);
  f.cleanup();f.controls.dispose();
});
test('2D middle and Shift-middle both pan, without enabling rotation',()=>{
  for(const shiftKey of [false,true]){
    const f=mouseFixture(true),before=f.camera.position.clone().sub(f.controls.target);
    f.drag(1,{shiftKey});assert.ok(f.controls.target.length()>.1);
    assert.ok(f.camera.position.clone().sub(f.controls.target).distanceTo(before)<1e-8);
    f.cleanup();f.controls.dispose();
  }
});
test('Blender binding preserves touch gestures and cleanup restores previous mouse controls',()=>{
  const f=mouseFixture();assert.deepEqual(f.controls.touches,f.touches);
  f.cleanup();assert.deepEqual(f.controls.mouseButtons,f.previous);
  assert.equal((f.element.handlers.get('pointerdown')||[]).filter(x=>x.capture).length,0);
  f.controls.dispose();
});
