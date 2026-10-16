const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const THREE = require('three');
const { OrbitControls } = require('three-stdlib');
const { loadSource } = require('./helpers/load-source.cjs');
const transition = loadSource('src/lib/cameraTransition.ts');
const { navigateCamera } = loadSource('src/lib/plannerCamera.ts');
const { furnitureCameraBounds } = loadSource('src/three/roomFurnitureCamera.ts');
const near = (a, b) => assert.ok(a.distanceTo(b) < 1e-7, `${a.toArray()} != ${b.toArray()}`);

class Surface {
  constructor() { this.handlers = new Map(); this.style = {}; this.clientWidth = 800; this.clientHeight = 600; }
  addEventListener(type, fn, capture = false) { const list = this.handlers.get(type) ?? []; list.push({ fn, capture }); this.handlers.set(type, list); }
  removeEventListener(type, fn) { this.handlers.set(type, (this.handlers.get(type) ?? []).filter(x => x.fn !== fn)); }
  emit(type, event = {}) { for (const { fn } of [...(this.handlers.get(type) ?? [])].sort((a,b) => Number(b.capture) - Number(a.capture))) fn(event); }
  releasePointerCapture() {}
}
function fixture() {
  const camera = new THREE.PerspectiveCamera(40, 4/3, .1, 300);
  camera.position.set(7, 5, 8);
  const surface = new Surface(); surface.ownerDocument = new Surface();
  const controls = new OrbitControls(camera, surface);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.minPolarAngle = .025; controls.maxPolarAngle = Math.PI / 2 - .015;
  controls.target.set(0, 1, 0); controls.update();
  return { camera, controls, surface };
}
const destination = (camera, target) => ({ ...transition.cameraPose(camera, target), position: new THREE.Vector3(-6, 4, -6), target: new THREE.Vector3(1, 1.5, 1), fov: 35, far: 400, zoom: 1 });

test('installed OrbitControls inertia cannot displace a programmatic endpoint or drift after completion', () => {
  const { camera, controls, surface } = fixture();
  try {
    const event = (x,y) => ({ button:0, pointerId:1, pointerType:'mouse', clientX:x, clientY:y, pageX:x, pageY:y, preventDefault(){} });
    surface.emit('pointerdown', event(100,100));
    surface.ownerDocument.emit('pointermove', event(190,135));
    surface.ownerDocument.emit('pointerup', event(190,135));
    const from = transition.cameraPose(camera, controls.target), to = destination(camera, controls.target);
    transition.beginCameraTransition(camera, from, to, false, controls);
    near(camera.position, from.position);
    for (let i=0;i<180;i++) { controls.update(); transition.advanceCameraTransition(camera, controls, 1/60); }
    near(camera.position, to.position); near(controls.target, to.target);
    assert.equal(controls.enableDamping, true); assert.equal(camera.far, 400);
    for (let i=0;i<60;i++) controls.update();
    near(camera.position, to.position); near(controls.target, to.target);
  } finally { controls.dispose(); }
});

test('30/60/120 Hz transitions have the same pose at equal elapsed time and exact final optics', () => {
  const poses = [];
  for (const fps of [30,60,120]) {
    const {camera,controls} = fixture();
    try {
      camera.zoom = 1.7;
      const from = transition.cameraPose(camera, controls.target), to = destination(camera, controls.target);
      transition.beginCameraTransition(camera, from, to, false, controls);
      for(let i=0;i<fps/5;i++) transition.advanceCameraTransition(camera, controls, 1/fps);
      poses.push(transition.cameraPose(camera, controls.target));
      assert.equal(transition.advanceCameraTransition(camera, controls, Infinity), false);
      near(camera.position, to.position); near(camera.up, to.up); near(controls.target, to.target);
      assert.equal(camera.zoom,1); assert.equal(camera.fov,35); assert.equal(camera.far,400);
      assert.equal(transition.advanceCameraTransition(camera, controls, 1), false);
    } finally { controls.dispose(); }
  }
  for(const pose of poses.slice(1)) { near(pose.position,poses[0].position); near(pose.target,poses[0].target); assert.ok(Math.abs(pose.zoom-poses[0].zoom)<1e-10); }
});

test('replacement starts at the visible pose; room-origin shifts move both endpoints without mutating callers', () => {
  const {camera,controls} = fixture();
  try {
    const from=transition.cameraPose(camera,controls.target),to=destination(camera,controls.target),original=to.position.clone();
    transition.beginCameraTransition(camera,from,to,false,controls);
    transition.advanceCameraTransition(camera,controls,.2);
    const visible=transition.cameraPose(camera,controls.target),next={...to,position:new THREE.Vector3(5,7,-4)};
    transition.beginCameraTransition(camera,visible,next,false,controls);near(camera.position,visible.position);
    const shift=new THREE.Vector3(-9,0,4);
    camera.position.add(shift);controls.target.add(shift);transition.shiftCameraTransition(camera,shift);
    transition.advanceCameraTransition(camera,controls,Infinity);
    near(camera.position,next.position.clone().add(shift));near(controls.target,next.target.clone().add(shift));near(to.position,original);
    transition.beginCameraTransition(camera,transition.cameraPose(camera,controls.target),to,true,controls);
    near(camera.position,to.position);near(controls.target,to.target);
    assert.equal(transition.advanceCameraTransition(camera,controls,1),false);
  } finally { controls.dispose(); }
});

test('furniture focus frames rotated/elevated dimensions in portrait view while retaining the orbit direction', () => {
  const piece={instanceId:'shelf',productId:'unregistered',x:2,z:-3,rotation:Math.PI/2,elevation:1.4,details:{dimensions:{w:2,d:.4,h:.8}}};
  const bounds=furnitureCameraBounds(piece);
  assert.ok(Math.abs(bounds.width-.4)<1e-8);assert.ok(Math.abs(bounds.depth-2)<1e-8);assert.ok(Math.abs(bounds.centerY-1.8)<1e-8);
  const {camera,controls}=fixture();
  try {
    camera.aspect=.45;camera.zoom=2;
    const direction=camera.position.clone().sub(controls.target).normalize();
    navigateCamera(camera,controls,'focus',bounds,.45);
    near(controls.target,new THREE.Vector3(2,1.8,-3));near(camera.position.clone().sub(controls.target).normalize(),direction);assert.equal(camera.zoom,1);
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]) {
      const screen=new THREE.Vector3(bounds.centerX+x*bounds.width/2,bounds.centerY+y*bounds.height/2,bounds.centerZ+z*bounds.depth/2).project(camera);
      assert.ok(Math.abs(screen.x)<1&&Math.abs(screen.y)<1&&screen.z<1);
    }
    navigateCamera(camera,controls,'focus',bounds,.45,true);assert.ok(Math.abs(controls.target.y-1.8)<1e-8);near(camera.up,new THREE.Vector3(0,0,-1));
  } finally {controls.dispose();}
});

test('all four side requests face the room centre and preserve the input bounds', () => {
  const bounds=Object.freeze({width:5,depth:4,height:2.7,centerX:4,centerZ:-2});
  for(const [action,axis,sign] of [['front','z',1],['back','z',-1],['left','x',-1],['right','x',1]]) {
    const {camera,controls}=fixture();
    try { navigateCamera(camera,controls,action,bounds,4/3);const offset=camera.position.clone().sub(controls.target);assert.ok(offset[axis]*sign>0);assert.ok(Math.abs(offset[axis==='x'?'z':'x'])<1e-8); }
    finally {controls.dispose();}
  }
});

function hookHarness() {
  const slots=[];let cursor=0,pending=[];
  return {
    react:{...React,useRef:value=>{const at=cursor++;return slots[at]??(slots[at]={current:value});},useEffect:(fn,deps)=>{const at=cursor++,old=slots[at];if(!old||deps.some((v,i)=>!Object.is(v,old.deps[i]))){slots[at]={deps};pending.push(()=>{old?.cleanup?.();slots[at].cleanup=fn();});}}},
    render(fn){cursor=0;pending=[];const result=fn();pending.forEach(work=>work());return result;},
    dispose(){slots.forEach(slot=>slot.cleanup?.());},
  };
}

test('pending navigation is interrupted before RAF and stale requests never replay after resize', () => {
  const oldWindow=global.window,oldRAF=global.requestAnimationFrame,oldCancel=global.cancelAnimationFrame;
  const frames=new Map();let id=0;
  global.window={matchMedia:()=>({matches:false})};global.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};global.cancelAnimationFrame=id=>frames.delete(id);
  const h=hookHarness(),{camera,controls,surface}=fixture();
  const state={camera,controls,gl:{domElement:surface},size:{width:800,height:600},invalidate(){}};
  const {CameraNavigation}=loadSource('src/three/CameraNavigation.tsx',{react:h.react,'@react-three/fiber':{useThree:()=>state},'@/lib/cameraTransition':transition});
  const bounds={width:5,depth:4,height:2.7,centerX:0,centerZ:0};
  let request={id:1,action:'front'},enabled=true;
  const render=()=>h.render(()=>CameraNavigation({request,bounds,enabled}));
  const flush=()=>{const work=[...frames.values()];frames.clear();work.forEach(fn=>fn());};
  try {
    const before=camera.position.clone();render();assert.equal(frames.size,1);
    surface.emit('wheel',{deltaY:0,preventDefault(){},stopPropagation(){}});flush();near(camera.position,before);
    state.size={width:600,height:600};render();assert.equal(frames.size,0);
    request={id:2,action:'left'};render();request={id:3,action:'right'};render();assert.equal(frames.size,1);flush();
    transition.advanceCameraTransition(camera,controls,Infinity);assert.ok(camera.position.x>controls.target.x);
    request={id:4,action:'right'};render();assert.equal(frames.size,1);flush();
    transition.advanceCameraTransition(camera,controls,.1);const at=camera.position.clone();
    enabled=false;render();assert.equal(transition.advanceCameraTransition(camera,controls,1),false);near(camera.position,at);
    enabled=true;render();assert.equal(frames.size,0,'unlock must not replay the cancelled request');
  } finally {h.dispose();controls.dispose();global.window=oldWindow;global.requestAnimationFrame=oldRAF;global.cancelAnimationFrame=oldCancel;}
});

test('controller cancels on user input, honours live reduced-motion changes and removes listeners on unmount', () => {
  const oldWindow=global.window,media=new Surface();media.matches=false;global.window={matchMedia:()=>media};
  const h=hookHarness(),{camera,controls,surface}=fixture();let tick,invalidations=0;
  const state={camera,controls,gl:{domElement:surface},invalidate:()=>invalidations++};
  const {CameraTransitionController}=loadSource('src/three/CameraTransitionController.tsx',{react:h.react,'@react-three/fiber':{useThree:()=>state,useFrame:fn=>{tick=fn;}},'@/lib/cameraTransition':transition});
  try {
    h.render(()=>CameraTransitionController());
    const to=destination(camera,controls.target);
    for(const event of ['pointerdown','wheel','keydown']) {
      transition.beginCameraTransition(camera,transition.cameraPose(camera,controls.target),to,false,controls);tick({},.1);const at=camera.position.clone();
      surface.emit(event,{button:2,pointerId:1,pointerType:'mouse',preventDefault(){},stopPropagation(){}});tick({},1);near(camera.position,at);
    }
    transition.beginCameraTransition(camera,transition.cameraPose(camera,controls.target),to,false,controls);
    media.matches=true;media.emit('change');near(camera.position,to.position);near(controls.target,to.target);
    const count=invalidations;tick({},1);assert.equal(invalidations,count);
    h.dispose();assert.equal(media.handlers.get('change').length,0);
    assert.equal(surface.handlers.get('keydown').length,0);
  } finally {controls.dispose();global.window=oldWindow;}
});
