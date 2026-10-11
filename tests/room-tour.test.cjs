const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { interiorCamera, cameraPointValid, lookAround, walkCamera, tourVerticalFov } = loadSource('src/lib/roomInteriorCamera.ts');
const options = { name: 'Office', width: 4, depth: 3, height: 2.7, door: true, window: true, doorWall: 'south', windowWall: 'north' };

test('legacy rooms get a valid viewpoint, including rooms with a column at the centre', () => {
  const room = { width: 4, depth: 3, height: 2.7, columns: [{ id: 'column', x: 1.6, z: 1.1, width: .8, depth: .8 }] };
  assert.equal(cameraPointValid(room, 0, 0), false);
  const point = interiorCamera(room);
  assert.equal(cameraPointValid(room, point.x, point.z), true);
  assert.equal(point.eyeHeight, 1.6);
  assert.equal(cameraPointValid(room, 2, 0), false);
  assert.equal(cameraPointValid(room, NaN, 0), false);
  const adjusted = interiorCamera({ ...room, interiorCamera: { x: 500, z: 0, eyeHeight: 80, yaw: NaN, pitch: 100 } });
  assert.equal(cameraPointValid(room, adjusted.x, adjusted.z), true);
  assert.ok(adjusted.eyeHeight < room.height && adjusted.pitch <= 1.35 && Number.isFinite(adjusted.yaw));
});

test('tour points avoid furniture and looking around keeps the saved position fixed', () => {
  const { roomTourCamera, tourPointValid } = loadSource('src/three/roomCameraPlacement.ts');
  const room = { width: 4, depth: 3, pieces: [{ instanceId: 'bed', productId: 'missing', x: 0, z: 0, rotation: Math.PI / 4 }] };
  const camera = roomTourCamera(room);
  assert.equal(tourPointValid(room, 0, 0), false);
  assert.equal(tourPointValid(room, camera.x, camera.z), true);
  const turned = lookAround(camera, 120, 10000);
  assert.equal(turned.x, camera.x); assert.equal(turned.z, camera.z); assert.equal(turned.eyeHeight, camera.eyeHeight);
  assert.notEqual(turned.yaw, camera.yaw); assert.equal(turned.pitch, -1.35);
});

test('natural FOV uses the longer viewport axis instead of widening on desktop', () => {
  const horizontal = (vertical, aspect) => 2 * Math.atan(Math.tan(vertical * Math.PI / 360) * aspect) * 180 / Math.PI;
  for (const aspect of [1, 1.6, 2.2, 3.5]) {
    assert.ok(Math.abs(horizontal(tourVerticalFov(60, aspect), aspect) - 60) < 1e-7);
    assert.ok(Math.abs(horizontal(tourVerticalFov(500, aspect), aspect) - 75) < 1e-7);
  }
  assert.ok(Math.abs(tourVerticalFov(60, .55)-60)<1e-7);
  assert.equal(interiorCamera({width:4,depth:3}).fov,60);
  assert.equal(interiorCamera({width:4,depth:3,interiorCamera:{x:0,z:0,eyeHeight:1.6,yaw:0,pitch:0,fov:NaN}}).fov,60);
});

test('walking follows heading, preserves eye height, and stops at walls, columns and furniture', () => {
  const { tourPointValid } = loadSource('src/three/roomCameraPlacement.ts');
  const room = { width:4, depth:3, pieces:[{instanceId:'desk',productId:'missing',x:.8,z:.4,rotation:Math.PI/4}],
    columns:[{id:'column',x:1.2,z:.3,width:.3,depth:.4}] };
  const clear = (x,z) => tourPointValid(room,x,z);
  let pose={x:0,z:0,eyeHeight:1.6,yaw:0,pitch:.2,fov:60};
  for(let i=0;i<200;i++)pose=walkCamera(pose,1,0,.016,clear);
  assert.ok(pose.z > -1.33 && pose.z < -1.25);
  assert.equal(pose.x,0);assert.equal(pose.eyeHeight,1.6);assert.equal(pose.pitch,.2);
  assert.equal(clear(pose.x,pose.z),true);
  pose={...pose,x:0,z:0,yaw:-Math.PI/2};
  for(let i=0;i<100;i++)pose=walkCamera(pose,1,0,.016,clear);
  assert.equal(clear(pose.x,pose.z),true);assert.ok(pose.x<.5);
  pose={...pose,x:0,z:-1,yaw:0};
  for(let i=0;i<100;i++)pose=walkCamera(pose,0,-1,.016,clear);
  assert.equal(clear(pose.x,pose.z),true);assert.ok(pose.x > -.5 && pose.x < -.2);
  const diagonal=walkCamera({x:0,z:0,eyeHeight:1.6,yaw:0,pitch:0},1,1,.1,()=>true);
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.z)-.12)<1e-7);
  assert.ok(Math.hypot(walkCamera(diagonal,1,0,100,()=>true).x-diagonal.x,walkCamera(diagonal,1,0,100,()=>true).z-diagonal.z)<=.120001);
});

test('room setup choices create real openings, persist room cameras and control snapped connections', () => {
  const old = global.localStorage, oldWindow = global.window;
  const storage = new Map();
  global.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
  global.window = { localStorage: global.localStorage };
  try {
    const { useDesigns: store } = loadSource('src/store/designs.ts');
    store.getState().createNew('40', 'Tour', 'living', { width: 4, depth: 3, height: 2.7 });
    const main = store.getState().current.activeRoomId;
    store.getState().updateRoom({ interiorCamera: { x: -.8, z: .6, eyeHeight: 1.7, yaw: .8, pitch: .2 } });
    store.getState().addRoom('office', options);
    const office = store.getState().current.activeRoomId;
    assert.equal(store.getState().current.roomName, 'Office');
    assert.deepEqual(store.getState().current.openings.map(o => [o.kind, o.wallId]), [['door', 'south'], ['window', 'north']]);
    store.getState().updateRoom({ interiorCamera: { x: .7, z: -.5, eyeHeight: 1.6, yaw: -.6, pitch: -.1 } });
    store.getState().selectRoom(main);
    assert.equal(store.getState().current.interiorCamera.x, -.8);
    store.getState().selectRoom(office);
    assert.equal(store.getState().current.interiorCamera.yaw, -.6);
    assert.equal(store.getState().moveRoom(office, { x: -8, z: 0 }, false), null);
    store.getState().saveCurrent();
    assert.equal(JSON.parse(storage.get('casa-designs-guest')).state.current.interiorCamera.x, .7);
    const savedId = store.getState().current.id;
    store.getState().createNew('40');
    store.getState().loadDesign(savedId);
    assert.equal(store.getState().current.interiorCamera.x, .7);
    store.getState().addRoom('bedroom', { ...options, name: 'Open room', door: false, window: false });
    const openRoom = store.getState().current.activeRoomId;
    assert.equal(store.getState().current.openings.length, 0);
    assert.equal(store.getState().moveRoom(openRoom, { x: 4, z: 0 }, false), null);
    const connection = store.getState().current.connections.find(c => c.roomA === openRoom || c.roomB === openRoom);
    assert.equal(connection.kind, 'open');
    store.getState().undo();
    assert.equal(store.getState().current.connections.length, 0);
    store.getState().redo();
    assert.equal(store.getState().current.connections[0].kind, 'open');
    store.getState().updateRoom({ interiorCamera: { x: .8, z: .4, eyeHeight: 1.6, yaw: .3, pitch: 0 } });
    store.getState().undo(); assert.equal(store.getState().current.interiorCamera.x, 0);
    store.getState().redo(); assert.equal(store.getState().current.interiorCamera.x, .8);
    const before = store.getState().current;
    assert.throws(() => store.getState().addRoom('office', { ...options, width: .2 }));
    assert.equal(store.getState().current, before);
  } finally { global.localStorage = old; global.window = oldWindow; }
});

test('door and window can share a sufficiently wide wall without overlapping', () => {
  const { configureAddedRoom } = loadSource('src/lib/addRoomOptions.ts');
  const { newDesignRoom } = loadSource('src/lib/roomDesign.ts');
  const { validateRoomOpenings } = loadSource('src/lib/roomOpenings.ts');
  const room = configureAddedRoom(newDesignRoom('living', []), { ...options, doorWall: 'north' });
  assert.equal(validateRoomOpenings(room), null);
  assert.notEqual(room.openings[0].position, room.openings[1].position);
  assert.throws(() => configureAddedRoom(room, { ...options, width: 1, doorWall: 'north' }));
});

function hooks() {
  const slots = []; let cursor = 0, effects = [];
  const effect = (fn, deps) => {
    const at = cursor++, old = slots[at];
    if (!old || deps.some((v, i) => !Object.is(v, old.deps[i]))) {
      slots[at] = { deps, cleanup: old?.cleanup };
      effects.push(() => { old?.cleanup?.(); slots[at].cleanup = fn(); });
    }
  };
  return {
    react: { useRef: v => slots[cursor++] ?? (slots[cursor - 1] = { current: v }), useEffect: effect, useLayoutEffect: effect },
    render(fn) { cursor = 0; effects = []; fn(); effects.forEach(e => e()); },
    unmount() { slots.forEach(s => s.cleanup?.()); },
  };
}
test('interior controller drags, walks, zooms, visits the next room and restores canvas bindings', () => {
  const h = hooks(), camera = new THREE.PerspectiveCamera(40,2), listeners = new Map();let frame;
  const canvas = { style: { touchAction: 'auto' }, tabIndex: -1, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
    focus() {}, setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {} };
  const state = { camera, gl: { domElement: canvas }, size:{width:1600,height:800}, invalidate() {} };
  const { RoomStreetView } = loadSource('src/three/RoomStreetView.tsx', { react: h.react, '@react-three/fiber': { useThree: () => state,useFrame:fn=>frame=fn } });
  let saved;
  let props = { roomId: 'a', locked: false, pose: { x: .7, z: -.6, eyeHeight: 1.6, yaw: .4, pitch: .2 }, onSave: p => saved = p,canWalk:(x,z)=>Math.abs(x)<1.8&&Math.abs(z)<1.3 };
  const render = patch => { props = { ...props, ...patch }; h.render(() => RoomStreetView(props)); };
  render();
  assert.deepEqual(camera.position.toArray(), [.7, 1.6, -.6]); assert.equal(camera.fov, tourVerticalFov(60,2));
  const event = { pointerId: 1, button: 0, clientX: 20, clientY: 30, stopImmediatePropagation() {}, preventDefault() {} };
  listeners.get('pointerdown')(event); listeners.get('pointermove')({ ...event, clientX: 140, clientY: 80 }); listeners.get('pointerup')(event);
  assert.deepEqual(camera.position.toArray(), [.7, 1.6, -.6]); assert.notEqual(saved.yaw, .4);
  listeners.get('wheel')({ ...event, deltaY: -100 }); assert.equal(camera.fov, tourVerticalFov(57,2));assert.equal(saved.fov,57);
  render({ pose: saved }); assert.equal(camera.fov, tourVerticalFov(57,2));
  render({pose:{...saved,fov:48}});assert.equal(camera.fov,tourVerticalFov(48,2));
  listeners.get('keydown')({...event,key:'ц',code:'KeyW'});frame(state,.1);frame(state,.1);assert.notEqual(camera.position.z,-.6);
  listeners.get('keyup')({...event,key:'ц',code:'KeyW'});assert.equal(saved.x,camera.position.x);assert.equal(saved.z,camera.position.z);assert.equal(saved.fov,48);
  const stopped=camera.position.clone();frame(state,.1);assert.deepEqual(camera.position.toArray(),stopped.toArray());
  listeners.get('keydown')({...event,key:'w',target:{closest:()=>({})}});frame(state,.1);assert.deepEqual(camera.position.toArray(),stopped.toArray());
  render({pose:saved,walkDirection:'backward'});frame(state,.1);assert.ok(camera.position.distanceTo(stopped)>.01);
  render({walkDirection:null});assert.equal(saved.z,camera.position.z);
  state.size={width:800,height:800};camera.aspect=1;render({pose:saved});assert.equal(camera.fov,48);
  render({ roomId: 'b', pose: { x: -1, z: .8, eyeHeight: 1.7, yaw: -1, pitch: 0 } });
  assert.deepEqual(camera.position.toArray(), [-1, 1.7, .8]); assert.equal(camera.fov,tourVerticalFov(60,1));
  render({ request: { id: 1, action: 'rotate-left' } }); assert.ok(Math.abs(saved.yaw + .65) < 1e-7);
  render({ locked: true }); const rotation = camera.quaternion.clone();
  listeners.get('pointerdown')(event); listeners.get('pointermove')({ ...event, clientX: 280 });
  const lockedPosition=camera.position.clone();listeners.get('keydown')({...event,key:'w'});frame(state,.1);assert.deepEqual(camera.position.toArray(),lockedPosition.toArray());
  assert.equal(camera.quaternion.angleTo(rotation), 0);
  h.unmount(); assert.equal(canvas.style.touchAction, 'auto'); assert.equal(canvas.tabIndex, -1); assert.equal(listeners.size, 0); assert.equal(camera.near, .1);
});

test('camera placement projects a canvas click onto the floor and removes its listener on unmount', () => {
  const h = hooks(), camera = new THREE.PerspectiveCamera(40, 1, .1, 100), listeners = new Map();
  camera.position.set(0, 8, .001); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const canvas = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 400 }), addEventListener: (n, fn) => listeners.set(n, fn), removeEventListener: n => listeners.delete(n) };
  const { CameraPointPlacement } = loadSource('src/three/RoomStreetView.tsx', { react: h.react, '@react-three/fiber': { useThree: () => ({ camera, gl: { domElement: canvas } }) } });
  let point;
  h.render(() => CameraPointPlacement({ onPlace: (x, z) => point = { x, z } }));
  listeners.get('pointerdown')({ button: 0, clientX: 200, clientY: 200, stopImmediatePropagation() {} });
  assert.ok(Math.abs(point.x) < 1e-7 && Math.abs(point.z) < 1e-7);
  h.unmount(); assert.equal(listeners.size, 0);
});

test('walking buttons release on cancel, keyboard and lost capture; FOV input groups slider edits', () => {
  const React=require('react');
  const { RoomTourControls }=loadSource('src/components/RoomTourControls.tsx');
  const nodes=tree=>!tree||typeof tree!=='object'?[]:[tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];
  const walking=[],fovs=[];let starts=0,ends=0;
  const props={design:{activeRoomId:'a',rooms:[{id:'a',name:'Room'}],interiorCamera:{fov:60}},locked:false,onSelectRoom(){},onExit(){},onWalk:d=>walking.push(d),onFov:f=>fovs.push(f),beginEdit:()=>starts++,endEdit:()=>ends++};
  const tree=nodes(RoomTourControls(props));
  const buttons=tree.filter(n=>n.type==='button'&&n.props.onPointerDown);
  assert.equal(buttons.length,4);
  const forward=buttons[0];
  forward.props.onPointerDown({button:0,pointerId:1,preventDefault(){},currentTarget:{setPointerCapture(){}}});assert.equal(walking.at(-1),'forward');
  forward.props.onPointerCancel();assert.equal(walking.at(-1),null);
  forward.props.onKeyDown({key:' ',preventDefault(){}});assert.equal(walking.at(-1),'forward');
  forward.props.onKeyUp({key:' '});assert.equal(walking.at(-1),null);
  forward.props.onLostPointerCapture();assert.equal(walking.at(-1),null);
  const slider=tree.find(n=>n.type==='input'&&n.props.type==='range');
  assert.equal(slider.props.value,60);assert.equal(slider.props.max,75);
  slider.props.onPointerDown();slider.props.onChange({target:{value:'50'}});slider.props.onPointerUp();
  assert.deepEqual(fovs,[50]);assert.equal(starts,1);assert.equal(ends,1);
  assert.ok(nodes(RoomTourControls({...props,locked:true})).filter(n=>n.props?.onPointerDown).every(n=>n.props.disabled));
});
