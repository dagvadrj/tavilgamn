const test = require("node:test");
const assert = require("node:assert/strict");
const { PerspectiveCamera, Vector2, Vector3, Plane, Raycaster } = require("three");
const { OrbitControls, MapControls } = require("three-stdlib");
const { loadSource } = require("./helpers/load-source.cjs");
const transition = loadSource("src/lib/cameraTransition.ts");
const { bindCursorNavigation, isSceneNavigationGesture, SCENE_NAVIGATION_START } = loadSource("src/three/sceneNavigation.ts", { '@/lib/cameraTransition': transition });
const { bindSmoothOrbitZoom } = loadSource("src/three/smoothOrbitZoom.ts", { '@/lib/cameraTransition': transition });

class Surface {
  constructor() { this.handlers = new Map(); this.style = {}; this.clientWidth = 800; this.clientHeight = 600; }
  getBoundingClientRect() { return { left: 40, top: 70, width: 800, height: 600 }; }
  addEventListener(type, fn, options) { const handlers = this.handlers.get(type) || []; handlers.push({ fn, capture: !!(options === true || options?.capture) }); this.handlers.set(type, handlers); }
  removeEventListener(type, fn) { this.handlers.set(type, (this.handlers.get(type) || []).filter(handler => handler.fn !== fn)); }
  emit(type, event) {
    event.preventDefault ??= () => {};
    event.stopPropagation ??= () => {};
    event.stopImmediatePropagation = () => { event.stopped = true; };
    for (const handler of [...(this.handlers.get(type) || [])].sort((a, b) => Number(b.capture) - Number(a.capture))) {
      if (event.stopped) break;
      handler.fn(event);
    }
  }
  dispatchEvent(event) { this.emit(event.type, event); return true; }
  releasePointerCapture() {}
}
function fixture(plan = false, smooth = false, reducedMotion = false) {
  const camera = new PerspectiveCamera(40, 4 / 3, .1, 300), element = new Surface();
  element.ownerDocument = new Surface(); element.ownerDocument.defaultView = new Surface();
  camera.position.set(4, 4, 7);
  if (plan) { camera.up.set(0, 0, -1); camera.position.set(0, 10, .001); }
  const controls = new (plan ? MapControls : OrbitControls)(camera, element);
  controls.target.set(0, plan ? 0 : 1, 0); controls.screenSpacePanning = true;
  controls.enableRotate = !plan; controls.enableDamping = true; controls.update();
  let allowed = true;
  const cleanup = bindCursorNavigation(controls, element, () => allowed, plan, smooth ? {invalidate(){},reducedMotion:()=>reducedMotion} : undefined);
  const stopSmooth = smooth ? bindSmoothOrbitZoom(controls, element, { invalidate() {}, allowed: () => allowed, reducedMotion: () => reducedMotion, plan }) : () => {};
  const interrupt = () => transition.cancelCameraTransition(camera);
  if (smooth) {
    controls.addEventListener('start', interrupt);
    element.addEventListener('pointerdown', interrupt, true);
    element.addEventListener('wheel', interrupt, true);
  }
  const event = (id, x, y) => ({ pointerId: id, pointerType: "touch", button: 0, clientX: x, clientY: y, pageX: x, pageY: y });
  const down = (id, x, y) => element.emit("pointerdown", event(id, x, y));
  const move = (id, x, y) => element.ownerDocument.emit("pointermove", event(id, x, y));
  const up = id => element.ownerDocument.emit("pointerup", event(id, 0, 0));
  const anchor = (x, y) => {
    camera.updateMatrixWorld();
    const ray = new Raycaster(), rect = element.getBoundingClientRect();
    ray.setFromCamera(new Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), camera);
    return ray.ray.intersectPlane(new Plane().setFromNormalAndCoplanarPoint(plan ? new Vector3(0, 1, 0) : camera.getWorldDirection(new Vector3()), controls.target), new Vector3());
  };
  const projected = point => { camera.updateMatrixWorld(); const ndc = point.clone().project(camera), rect = element.getBoundingClientRect(); return [(ndc.x + 1) / 2 * rect.width + rect.left, (1 - ndc.y) / 2 * rect.height + rect.top]; };
  return { camera, controls, element, down, move, up, anchor, projected, stopSmooth, setAllowed: value => { allowed = value; }, dispose() { stopSmooth(); cleanup(); controls.dispose(); } };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} vs ${expected}`);

for (const plan of [false, true]) {
  test(`${plan ? 'plan' : 'perspective'} smooth wheel advances over frames and keeps the cursor anchor`, () => {
    const f = fixture(plan, true);
    try {
      const before = f.camera.position.clone(), distance = f.controls.getDistance(), point = f.anchor(630, 260);
      f.element.emit('wheel', { clientX: 630, clientY: 260, deltaY: -100, deltaMode: 0 });
      near(f.camera.position.distanceTo(before), 0);
      assert.equal(transition.advanceCameraTransition(f.camera, f.controls, 12), true);
      near(f.camera.position.distanceTo(before), 0);
      for (let i = 0; i < 30; i++) {
        f.controls.update(); transition.advanceCameraTransition(f.camera, f.controls, 1 / 60);
        const projected = f.projected(point); near(projected[0], 630); near(projected[1], 260);
      }
      near(f.controls.getDistance(), distance * Math.exp(-.15));
      const final = f.camera.position.clone();
      for (let i = 0; i < 30; i++) f.controls.update();
      near(f.camera.position.distanceTo(final), 0);
    } finally { f.dispose(); }
  });
}

test('smooth wheel accumulates rapid ticks, reverses cleanly and obeys distance limits', () => {
  const f = fixture(false, true), wheel = deltaY => f.element.emit('wheel', { clientX: 440, clientY: 370, deltaY, deltaMode: 0 });
  try {
    const distance = f.controls.getDistance();
    for (let i = 0; i < 5; i++) wheel(-100);
    transition.advanceCameraTransition(f.camera, f.controls, Infinity);
    near(f.controls.getDistance(), distance * Math.exp(-.75));
    for (let i = 0; i < 5; i++) wheel(100);
    transition.advanceCameraTransition(f.camera, f.controls, Infinity); near(f.controls.getDistance(), distance);
    f.controls.minDistance = 2; f.controls.maxDistance = 15;
    for (let i = 0; i < 20; i++) wheel(-600);
    transition.advanceCameraTransition(f.camera, f.controls, Infinity); near(f.controls.getDistance(), 2);
    for (let i = 0; i < 20; i++) wheel(600);
    transition.advanceCameraTransition(f.camera, f.controls, Infinity); near(f.controls.getDistance(), 15);
  } finally { f.dispose(); }
});

test('smooth wheel respects editing locks, reduced motion, interruption and cleanup', () => {
  const f = fixture(false, true), wheel = () => f.element.emit('wheel', { clientX: 440, clientY: 370, deltaY: -100 });
  try {
    f.controls.enabled = false; f.setAllowed(false);
    const before = f.camera.position.clone(); wheel(); near(f.camera.position.distanceTo(before), 0);
    f.setAllowed(true); f.controls.enabled = true;
    wheel(); transition.advanceCameraTransition(f.camera, f.controls, .05);
    const at = f.camera.position.clone(); f.controls.dispatchEvent({ type: 'start' });
    assert.equal(transition.advanceCameraTransition(f.camera, f.controls, 1), false); near(f.camera.position.distanceTo(at), 0);
    wheel(); f.stopSmooth(); assert.equal(transition.advanceCameraTransition(f.camera, f.controls, 1), false);
    assert.equal(f.element.handlers.get('wheel').filter(h => h.capture).length, 1);
  } finally { f.dispose(); }
  const reduced = fixture(false, true, true);
  try {
    const distance = reduced.controls.getDistance();
    reduced.element.emit('wheel', { clientX: 440, clientY: 370, deltaY: -100 });
    near(reduced.controls.getDistance(), distance * Math.exp(-.15));
    assert.equal(transition.advanceCameraTransition(reduced.camera, reduced.controls, 1 / 60), false);
  } finally { reduced.dispose(); }
});

for (const plan of [false, true]) {
  test(`${plan ? "2D room map" : "3D product/kitchen/room"} wheel zoom stays under an off-centre mouse`, () => {
    const f = fixture(plan);
    try {
      const point = f.anchor(630, 260), distance = f.controls.getDistance();
      f.element.emit("wheel", { clientX: 630, clientY: 260, deltaY: -100 });
      assert.ok(f.controls.getDistance() < distance);
      const projected = f.projected(point); near(projected[0], 630); near(projected[1], 260);
    } finally { f.dispose(); }
  });
  test(`${plan ? "2D room map" : "3D product/kitchen/room"} two-finger pinch and pan keep the original point between the fingers`, () => {
    const f = fixture(plan);
    try {
      const point = f.anchor(580, 270), distance = f.controls.getDistance();
      f.down(1, 510, 270); f.down(2, 650, 270);
      assert.equal(isSceneNavigationGesture(f.element), true);
      f.move(1, 470, 270); f.move(2, 690, 270);
      assert.ok(f.controls.getDistance() < distance);
      let projected = f.projected(point); near(projected[0], 580); near(projected[1], 270);
      const zoomed = f.controls.getDistance();
      f.move(1, 510, 310); f.move(2, 730, 310);
      projected = f.projected(point); near(projected[0], 620); near(projected[1], 310); near(f.controls.getDistance(), zoomed);
      f.up(1); assert.equal(isSceneNavigationGesture(f.element), true);
      const stopped = f.camera.position.clone(); f.move(2, 750, 350); near(f.camera.position.distanceTo(stopped), 0);
      f.up(2); assert.equal(isSceneNavigationGesture(f.element), false);
      assert.equal(f.controls.enableDamping, true);
    } finally { f.dispose(); }
  });
}

test("pinch respects distance bounds and still pans at the limit", () => {
  const f = fixture();
  try {
    f.controls.minDistance = 4; f.controls.maxDistance = 12;
    f.down(1, 550, 260); f.down(2, 570, 260);
    f.move(1, 250, 260); f.move(2, 850, 260); near(f.controls.getDistance(), 4);
    const point = f.anchor(550, 260);
    f.move(1, 280, 290); f.move(2, 880, 290);
    near(f.controls.getDistance(), 4);
    const projected = f.projected(point); near(projected[0], 580); near(projected[1], 290);
    f.move(1, 578, 290); f.move(2, 580, 290); near(f.controls.getDistance(), 12);
  } finally { f.dispose(); }
});

test("two fingers interrupt object editing, while explicit camera lock prevents navigation", () => {
  const f = fixture();
  try {
    let interrupts = 0;
    f.element.addEventListener(SCENE_NAVIGATION_START, () => { interrupts++; });
    f.down(1, 400, 300); f.controls.enabled = false;
    f.down(2, 600, 300);
    assert.equal(interrupts, 1); assert.equal(f.controls.enabled, true);
    f.up(1); f.up(2);
    f.setAllowed(false); f.controls.enabled = false;
    const before = f.camera.position.clone();
    f.down(3, 400, 300); f.down(4, 600, 300); f.move(3, 200, 300);
    assert.equal(interrupts, 1); near(f.camera.position.distanceTo(before), 0);
  } finally { f.dispose(); }
});

test("single-finger orbit remains native; cancel/cleanup restores controls and removes gesture listeners", () => {
  const f = fixture();
  const previous = f.camera.position.clone();
  f.down(1, 400, 300); f.move(1, 460, 340);
  assert.ok(f.camera.position.distanceTo(previous) > .01);
  f.controls.autoRotate = true;
  f.down(2, 650, 340);
  assert.equal(f.controls.autoRotate, false);
  f.element.ownerDocument.emit("pointercancel", { pointerId: 1 });
  f.element.ownerDocument.emit("pointercancel", { pointerId: 2 });
  assert.equal(f.controls.autoRotate, true);
  f.dispose();
  assert.equal(isSceneNavigationGesture(f.element), false);
  assert.equal(f.controls.zoomToCursor, false);
  for (const handlers of f.element.ownerDocument.handlers.values()) assert.equal(handlers.filter(handler => handler.capture).length, 0);
});

test("blur cancels both fingers so the next single-finger orbit has no stale native pointers", () => {
  const f = fixture();
  try {
    f.down(1, 400, 300); f.down(2, 600, 300);
    f.element.ownerDocument.defaultView.emit("blur", {});
    assert.equal(isSceneNavigationGesture(f.element), false);
    const before = f.camera.position.clone();
    f.down(3, 400, 300); f.move(3, 480, 360);
    assert.ok(f.camera.position.distanceTo(before) > .01);
  } finally { f.dispose(); }
});

for(const plan of [false,true])test(`${plan?'plan':'orbit'} smooth pinch accumulates input, retains its anchor and settles after release`,()=>{
  const f=fixture(plan,true);
  try{
    const point=f.anchor(580,270),distance=f.controls.getDistance();
    f.down(1,510,270);f.down(2,650,270);
    f.move(1,470,270);f.move(2,690,270);
    near(f.controls.getDistance(),distance);
    for(let i=0;i<6;i++)transition.advanceCameraTransition(f.camera,f.controls,1/60);
    assert.ok(f.controls.getDistance()<distance);
    f.move(1,510,310);f.move(2,730,310);f.up(1);f.up(2);
    for(let i=0;i<30;i++){f.controls.update();transition.advanceCameraTransition(f.camera,f.controls,1/60);}
    near(f.controls.getDistance(),distance*140/220);
    const projected=f.projected(point);near(projected[0],620);near(projected[1],310);
    const final=f.camera.position.clone();for(let i=0;i<30;i++)f.controls.update();near(f.camera.position.distanceTo(final),0);
  }finally{f.dispose();}
});
