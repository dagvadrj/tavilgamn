const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const entry = loadSource('src/lib/roomEntryTransition.ts');
const { tourVerticalFov } = loadSource('src/lib/roomInteriorCamera.ts');
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('wheel input normalises pixel, line and page modes and rejects invalid deltas', () => {
  assert.equal(entry.wheelPixels({ deltaY: -3, deltaMode: 1 }, 800), -48);
  assert.equal(entry.wheelPixels({ deltaY: 0.5, deltaMode: 2 }, 800), 400);
  assert.equal(entry.wheelPixels({ deltaY: 4000, deltaMode: 0 }, 800), 600);
  assert.equal(entry.wheelPixels({ deltaY: NaN, deltaMode: 0 }, 800), 0);
  let state = { progress: 0, target: 0 };
  for (let i = 0; i < 260; i++) state = entry.feedEntry(state, -2); // trackpad: many small deltas
  assert.equal(state.target, 1);
  assert.equal(entry.feedEntry(state, -100).target, 1, 'target is bounded');
});

test('progress is equal at equal time on 30/60/120 Hz and settles exactly', () => {
  const sampled = [30, 60, 120].map(fps => {
    let state = { progress: 0, target: 1 };
    for (let i = 0; i < fps * 0.2; i++) state = entry.advanceEntry(state, 1 / fps);
    return state.progress;
  });
  for (const value of sampled) near(value, sampled[0], 1e-12);
  let state = { progress: 0, target: 1 };
  for (let i = 0; i < 200; i++) state = entry.advanceEntry(state, 1 / 60);
  assert.equal(state.progress, 1);
  assert.ok(entry.entrySettled(state));
  assert.equal(entry.advanceEntry({ progress: 0.2, target: 0.9 }, 1 / 60, true).progress, 0.9, 'reduced motion follows input without easing');
});

test('reversing mid-way continues from the displayed progress with no snap', () => {
  let state = entry.feedEntry({ progress: 0, target: 0 }, -260);
  for (let i = 0; i < 9; i++) state = entry.advanceEntry(state, 1 / 60);
  const shown = state.progress;
  assert.ok(shown > 0.2 && shown < 0.5);
  state = entry.feedEntry(state, 600);
  assert.equal(state.target, 0);
  const next = entry.advanceEntry(state, 1 / 60);
  assert.ok(next.progress < shown && shown - next.progress < 0.1, 'one frame moves a small step back');
});

test('the interior end pose is exactly the pose RoomStreetView applies', () => {
  const pose = { x: 0.7, z: -0.6, eyeHeight: 1.6, yaw: 0.4, pitch: -0.12, fov: 60 };
  const end = entry.interiorEntryPose(pose, 2);
  const reference = new THREE.PerspectiveCamera();
  reference.position.set(0.7, 1.6, -0.6);
  reference.rotation.set(-0.12, 0.4, 0, 'YXZ');
  assert.ok(end.quaternion.angleTo(reference.quaternion) < 1e-7);
  assert.deepEqual(end.position.toArray(), [0.7, 1.6, -0.6]);
  assert.equal(end.fov, tourVerticalFov(60, 2));
  const camera = new THREE.PerspectiveCamera(45, 2);
  const start = { position: new THREE.Vector3(4, 4, 4), quaternion: new THREE.Quaternion(), fov: 45 };
  entry.writeEntryPose(camera, start, end, 1);
  assert.ok(camera.quaternion.angleTo(reference.quaternion) < 1e-7);
  assert.deepEqual(camera.position.toArray(), [0.7, 1.6, -0.6]);
  entry.writeEntryPose(camera, start, end, 0);
  assert.deepEqual(camera.position.toArray(), [4, 4, 4]);
  assert.equal(camera.fov, 45);
});

test('entry continues the exterior heading and the exit overview sits beyond the entry threshold', () => {
  const position = new THREE.Vector3(3, 3, 3), target = new THREE.Vector3(0, 1, 0);
  const yaw = entry.entryYaw(position, target, 0);
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
  const toward = new THREE.Vector3(target.x - position.x, 0, target.z - position.z).normalize();
  assert.ok(forward.angleTo(toward) < 1e-9);
  const bounds = { minX: -2.5, maxX: 2.5, minZ: -2, maxZ: 2 };
  const overview = entry.exteriorOverview(bounds, 2.7, yaw, 45, 1.6);
  assert.ok(overview.position.distanceTo(overview.target) > entry.roomEntryDistance(bounds), 'leaving does not land on the threshold');
  const look = overview.target.clone().sub(overview.position).setY(0).normalize();
  assert.ok(look.angleTo(forward) < 1e-9, 'the exit view keeps looking the same way');
  assert.ok(entry.entryTargetOverRoom(new THREE.Vector3(0, 1, 0), bounds));
  assert.ok(!entry.entryTargetOverRoom(new THREE.Vector3(9, 1, 0), bounds));
});

function controllerHarness(initial) {
  const slots = []; let cursor = 0, frame;
  const effect = (fn, deps) => {
    const at = cursor++, old = slots[at];
    if (!old || deps.some((v, i) => !Object.is(v, old.deps[i]))) { slots[at] = { deps, cleanup: old?.cleanup, run: () => { old?.cleanup?.(); slots[at].cleanup = fn(); } }; slots[at].pending = true; }
  };
  const react = { useRef: v => slots[cursor++] ?? (slots[cursor - 1] = { current: v }), useEffect: effect, useLayoutEffect: effect };
  const view = new EventTarget();
  const previousWindow = global.window;
  global.window = { matchMedia: () => ({ matches: false }) };
  const root = { ownerDocument: { defaultView: view }, contains: () => true, clientHeight: 800 };
  const camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 300);
  const controls = { target: new THREE.Vector3(0, 1, 0), enabled: true, update() { camera.lookAt(this.target); camera.updateMatrixWorld(); } };
  camera.position.set(2, 2.4, 2); controls.update();
  const state = { camera, gl: { domElement: root }, invalidate() {}, controls, events: { connected: root }, size: { width: 1600, height: 1000 } };
  const { RoomEntryController } = loadSource('src/three/RoomEntryController.tsx', { react, '@react-three/fiber': { useThree: select => select ? select(state) : state, useFrame: fn => { frame = fn; } } });
  const { createInteriorEntryChannel } = loadSource('src/three/roomEntryChannel.ts');
  const channel = createInteriorEntryChannel(), memory = { current: null }, calls = [];
  let props = { interior: false, enabled: true, roomId: 'r', pose: { x: 0.5, z: 0.4, eyeHeight: 1.6, yaw: 0, pitch: 0, fov: 60 },
    bounds: { minX: -2.5, maxX: 2.5, minZ: -2, maxZ: 2 }, height: 2.7, originX: 0, originZ: 0, channel, memory,
    onTransition: t => calls.push(['transition', t]), onEnter: p => calls.push(['enter', p]), onExit: p => calls.push(['exit', p]), ...initial };
  const render = patch => { props = { ...props, ...patch }; cursor = 0; RoomEntryController(props); slots.forEach(s => { if (s?.pending) { s.pending = false; s.run(); } }); };
  render();
  const wheel = (deltaY, deltaMode = 0) => {
    const event = new Event('wheel', { cancelable: true });
    Object.assign(event, { deltaY, deltaMode });
    view.dispatchEvent(event);
    return event;
  };
  const press = () => { const e = new Event('pointerdown', { cancelable: true }); view.dispatchEvent(e); return e; };
  return { camera, controls, channel, memory, calls, render, wheel, press, frames: (n, dt = 1 / 60) => { for (let i = 0; i < n; i++) frame({}, dt); },
    dispose() { slots.forEach(s => s?.cleanup?.()); global.window = previousWindow; } };
}

test('scroll-in walks into the room as the only camera writer; scroll-out mid-way returns exactly', () => {
  const h = controllerHarness();
  try {
    const start = h.camera.position.clone(), startRotation = h.camera.quaternion.clone();
    const first = h.wheel(-120);
    assert.equal(first.defaultPrevented, true, 'the entry owns this wheel event');
    assert.equal(h.controls.enabled, false, 'orbit controls cannot also process input');
    h.frames(8);
    const midway = h.camera.position.clone();
    assert.ok(midway.distanceTo(start) > 0.05);
    h.wheel(240);
    h.frames(1);
    assert.ok(h.camera.position.distanceTo(midway) < 0.15, 'reversal starts from the displayed pose');
    h.frames(120);
    assert.ok(h.camera.position.distanceTo(start) < 1e-9);
    assert.ok(h.camera.quaternion.angleTo(startRotation) < 1e-7);
    assert.equal(h.controls.enabled, true);
    assert.deepEqual(h.calls.map(c => c[1]), ['entering', null]);
    assert.equal(h.memory.current, null, 'an abandoned entry is not remembered');
  } finally { h.dispose(); }
});

test('a full scroll-in commits the interior pose, then scroll-out at the widest view returns to it', async () => {
  const h = controllerHarness();
  try {
    const exterior = h.camera.position.clone();
    for (let i = 0; i < 6; i++) h.wheel(-100);
    h.frames(120);
    const enter = h.calls.find(c => c[0] === 'enter');
    assert.ok(enter, 'entry committed');
    assert.deepEqual(h.camera.position.toArray(), [0.5, 1.6, 0.4]);
    assert.equal(h.wheel(-100).defaultPrevented, true, 'input waits for the mode switch');
    h.render({ interior: true });
    assert.ok(h.memory.current && h.memory.current.pose.position.distanceTo(exterior) < 1e-9);
    assert.equal(h.wheel(100).defaultPrevented, true, 'inertia right after a commit cannot bounce back out');
    await new Promise(resolve => setTimeout(resolve, 220));
    // Not at the widest interior view: scroll-out belongs to the interior FOV zoom.
    assert.equal(h.wheel(100).defaultPrevented, false);
    let held = 0; h.channel.atWidestView = () => true; h.channel.hold = () => held++;
    for (let i = 0; i < 6; i++) h.wheel(100);
    assert.equal(h.channel.suspended, true); assert.equal(held, 1);
    h.frames(120);
    const exit = h.calls.find(c => c[0] === 'exit');
    assert.ok(exit && exit[1].position.distanceTo(exterior) < 1e-9);
    assert.ok(h.camera.position.distanceTo(exterior) < 1e-9);
    h.render({ interior: false });
    assert.equal(h.channel.suspended, false);
    assert.equal(h.calls.at(-1)[1], null);
  } finally { h.dispose(); }
});

test('far orbit views zoom normally, a press settles mid-way, and a camera request aborts', () => {
  const h = controllerHarness();
  try {
    h.camera.position.set(8, 6, 8); h.controls.update();
    assert.equal(h.wheel(-100).defaultPrevented, false, 'outside the entry threshold the orbit zoom keeps the wheel');
    h.camera.position.set(2, 2.4, 2); h.controls.update();
    const start = h.camera.position.clone();
    h.wheel(-150); h.frames(4);
    assert.equal(h.press().defaultPrevented, true);
    h.frames(120);
    assert.ok(h.camera.position.distanceTo(start) < 1e-9, 'a press below half-way settles back outside');
    h.wheel(-150); h.frames(3);
    h.render({ abortKey: 7 });
    assert.ok(h.camera.position.distanceTo(start) < 1e-9);
    assert.equal(h.controls.enabled, true);
  } finally { h.dispose(); }
});
