const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { createCameraMotion } = loadSource("src/three/cameraMotion.ts");

test("only actual control motion uses preview; damping extends the 250ms quiet period", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const edges = [], motion = createCameraMotion(value => edges.push(value));
  motion.change(); motion.start();
  assert.deepEqual(edges, [], "holding a stationary pointer is not camera movement");
  motion.change(); motion.end();
  context.mock.timers.tick(200); motion.change();
  context.mock.timers.tick(249);
  assert.deepEqual(edges, [true]);
  context.mock.timers.tick(1);
  assert.deepEqual(edges, [true, false]);
  motion.change();
  assert.deepEqual(edges, [true, false], "idle/programmatic changes do not enable preview");
  motion.dispose();
});

test("wheel/pinch bursts and paused drags restore full quality without distance rules", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const edges = [], motion = createCameraMotion(value => edges.push(value));
  for (let i = 0; i < 5; i++) { motion.start(); motion.change(); motion.end(); context.mock.timers.tick(50); }
  assert.deepEqual(edges, [true]);
  context.mock.timers.tick(250);
  motion.start(); motion.change(); context.mock.timers.tick(250);
  assert.deepEqual(edges, [true, false, true, false], "a paused held gesture also returns to high");
  motion.change(); assert.equal(edges.at(-1), true);
  motion.end(); motion.dispose();
});

test("idle automatic product rotation does not force preview forever", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const edges = [], motion = createCameraMotion(value => edges.push(value));
  motion.change(true); assert.deepEqual(edges, []);
  motion.start(); motion.change(true); motion.end();
  for (let i = 0; i < 5; i++) { context.mock.timers.tick(50); motion.change(true); }
  assert.deepEqual(edges, [true, false]);
  motion.dispose();
});

test("blur/cancel and disposal clean up pending restoration", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const edges = [], motion = createCameraMotion(value => edges.push(value));
  motion.start(); motion.change(); motion.end(); motion.cancel();
  context.mock.timers.tick(1000); assert.deepEqual(edges, [true, false]);
  motion.start(); motion.change(); motion.end(); motion.dispose();
  context.mock.timers.tick(1000); assert.deepEqual(edges, [true, false, true]);
});

test("furniture dragging keeps preview active through camera idle, then restores high after both interactions finish", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const previousWindow = global.window, previousDocument = global.document;
  global.window = new EventTarget();
  global.document = new EventTarget();
  const React = require("react");
  const listeners = new Map();
  const controls = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
  };
  let moving = false, cleanup, mounted = false, invalidations = 0;
  const { CameraMotionPreview } = loadSource("src/three/CameraMotionPreview.tsx", {
    react: { ...React,
      useState: () => [moving, value => { moving = value; }],
      useRef: value => ({ current: value }),
      useEffect: fn => { if (!mounted) { mounted = true; cleanup = fn(); } },
    },
    "@react-three/fiber": { useThree: selector => selector({ controls, invalidate: () => invalidations++ }), useFrame() {} },
  });
  const preview = dragging => CameraMotionPreview({ interactionActive: dragging, children: null }).props.value;
  try {
    assert.equal(preview(false), false);
    assert.equal(preview(true), true, "stationary camera must still use the placement preview");
    listeners.get("start")(); listeners.get("change")(); listeners.get("end")();
    context.mock.timers.tick(300);
    assert.equal(preview(true), true, "camera quiet timeout cannot end a furniture drag preview");
    assert.equal(preview(false), false, "dropping the furniture restores high when the camera is idle");
    listeners.get("start")(); listeners.get("change")();
    assert.equal(preview(false), true, "dropping does not override an active camera gesture");
    global.window.dispatchEvent(new Event("blur"));
    assert.equal(preview(false), false);
    assert.ok(invalidations >= 4, "quality changes request a frame in demand rendering");
  } finally {
    cleanup?.();
    global.window = previousWindow; global.document = previousDocument;
  }
  assert.equal(listeners.size, 0);
});

test("observed interior travel and view transitions restore after the camera settles", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const edges = [], motion = createCameraMotion(value => edges.push(value));
  motion.observe();
  context.mock.timers.tick(200); motion.observe();
  context.mock.timers.tick(249); assert.deepEqual(edges, [true]);
  context.mock.timers.tick(1); assert.deepEqual(edges, [true, false]);
  motion.observe(true); assert.deepEqual(edges, [true, false], "idle automatic rotation stays sharp");
  motion.start(); motion.observe(true); motion.end();
  context.mock.timers.tick(250); assert.deepEqual(edges, [true, false, true, false]);
  motion.dispose();
});

test("real camera pose changes are detected without controls and material-only renders stay sharp", context => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const oldWindow = global.window, oldDocument = global.document;
  global.window = new EventTarget(); global.document = new EventTarget();
  const React = require("react"), THREE = require("three");
  let moving = false, cleanup, frame, mounted = false;
  const refs = []; let cursor = 0;
  const { CameraMotionPreview } = loadSource("src/three/CameraMotionPreview.tsx", {
    react: { ...React, useState: () => [moving, value => { moving = value; }],
      useRef: value => refs[cursor++] ?? (refs[cursor - 1] = { current: value }),
      useEffect: fn => { if (!mounted) { mounted = true; cleanup = fn(); } } },
    "@react-three/fiber": { useFrame: fn => { frame = fn; }, useThree: selector => selector({ invalidate() {} }) },
  });
  const camera = new THREE.PerspectiveCamera();
  const render = () => { cursor = 0; return CameraMotionPreview({ children: null }).props.value; };
  try {
    render(); frame({ camera }); frame({ camera }); assert.equal(render(), false);
    for (const change of [() => camera.position.x += 0.1, () => camera.rotation.y += 0.1,
      () => camera.fov += 5, () => camera.zoom += 0.1]) {
      change(); frame({ camera }); assert.equal(render(), true);
      context.mock.timers.tick(250); assert.equal(render(), false);
      frame({ camera }); assert.equal(render(), false, "unchanged camera must not restart preview");
    }
    camera.position.x += 0.0001; frame({ camera });
    assert.equal(render(), false, "imperceptible damping tail must not re-enter preview after restoration");
    camera.position.x += 0.001; frame({ camera }); assert.equal(render(), true, "slow motion accumulates against the last sampled pose");
    context.mock.timers.tick(250); assert.equal(render(), false);
    frame({ camera: new THREE.PerspectiveCamera() }); assert.equal(render(), false, "camera replacement rebases pose");
    camera.position.z += 1; frame({ camera }); camera.position.z += 1; frame({ camera });
    assert.equal(render(), true);
    global.window.dispatchEvent(new Event("blur")); assert.equal(render(), false);
  } finally { cleanup?.(); global.window = oldWindow; global.document = oldDocument; }
  context.mock.timers.tick(1000);
});
