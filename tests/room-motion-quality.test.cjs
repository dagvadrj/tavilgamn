const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");

test("room camera interaction lowers pixel work and restores the configured DPR", () => {
  let moving = false, dpr = 1.5, configuredDpr = [1, 1.5];
  const effects = [], values = [];
  const state = { viewport: { initialDpr: 1.5 }, setDpr: value => { dpr = value; values.push(value); }, invalidate() {} };
  const { RoomMotionResolution } = loadSource("src/three/RoomMotionQuality.tsx", {
    react: { ...require("react"), useEffect: fn => { effects.push(fn); } },
    "@react-three/fiber": { useThree: selector => selector(state) },
    "@react-three/drei": { ContactShadows() {} },
    "./CameraMotionPreview": { useCameraMotionPreview: () => moving },
  });
  function render() { effects.length = 0; RoomMotionResolution({ dpr: configuredDpr }); effects[0](); }
  render(); assert.equal(dpr, 1.5);
  moving = true; render(); assert.equal(dpr, 1.125, "desktop interaction keeps cabinet edges above 1 CSS pixel");
  moving = false; render(); assert.equal(dpr, 1.5);
  configuredDpr = 1; moving = true; render(); assert.equal(dpr, 0.85, "1x mobile still reduces pixel work"); moving = false; render(); assert.equal(dpr, 1, "mobile cap survives interaction");
  configuredDpr = 0.75; moving = true; render(); assert.equal(dpr, 0.75 * 0.85);
  const unmount = effects[1](); unmount(); assert.equal(dpr, 0.75);
  configuredDpr = 0.4; render(); assert.equal(dpr, 0.4, "preview must never increase an already lower DPR");
  state.viewport.initialDpr = 0; render(); assert.equal(values.at(-1), 0.4);
  state.viewport.initialDpr = 3; configuredDpr = [1, 2]; moving = false;
  render(); assert.equal(dpr, 2, "high-density displays respect the two-pixel ceiling");
  moving = true; render(); assert.equal(dpr, 1.25, "high-density interaction remains bounded");
  moving = false; render(); assert.equal(dpr, 2, "full detail returns once motion stops");
  state.viewport.initialDpr = 1; moving = true;
  render(); assert.equal(dpr, 1, "desktop 1x screens keep sharp edges during motion");
});

test("contact shadows freeze only for camera motion and keep updating during placement", () => {
  let moving = false;
  const { RoomContactShadows } = loadSource("src/three/RoomMotionQuality.tsx", {
    react: { ...require("react"), useRef: value => ({ current: value }) },
    "@react-three/fiber": { useFrame() {} }, "@react-three/drei": { ContactShadows() {} },
    "./CameraMotionPreview": { useCameraMotionPreview: () => moving },
  });
  const render = updatingLayout => RoomContactShadows({ updatingLayout, opacity: 0.2 });
  assert.equal(render(false).props.frames, Infinity);
  moving = true;
  assert.equal(render(false).props.frames, 1);
  assert.equal(render(true).props.frames, Infinity);
  assert.equal(render(true).props.opacity, 0.2);
  moving = false; assert.equal(render(false).props.frames, Infinity);
});

test("camera-only shadow cache refreshes on edits/delivery and restores renderer policy on rest/unmount", () => {
  const oldWindow = global.window; global.window = new EventTarget();
  let moving = false, invalidations = 0, cursor = 0;
  const slots = [], pending = [], gl = { shadowMap: { autoUpdate: true, needsUpdate: false } };
  const { PlannerMotionShadows } = loadSource("src/three/RoomMotionQuality.tsx", {
    react: { ...require("react"), useEffect: (fn, deps) => {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) pending.push(() => {
        old?.cleanup?.(); slots[index] = { deps, cleanup: fn() };
      });
    } },
    "@react-three/fiber": { useThree: selector => selector({ gl, invalidate }) },
    "@react-three/drei": { ContactShadows() {} },
    "./CameraMotionPreview": { useCameraMotionPreview: () => moving },
  });
  function invalidate() { invalidations++; }
  const revision = {};
  const render = (updatingLayout = false, currentRevision = revision) => {
    cursor = 0; PlannerMotionShadows({ updatingLayout, revision: currentRevision });
    pending.splice(0).forEach(fn => fn());
  };
  try {
    render(); assert.equal(gl.shadowMap.autoUpdate, true);
    gl.shadowMap.needsUpdate = false; moving = true; render();
    assert.equal(gl.shadowMap.autoUpdate, false); assert.equal(gl.shadowMap.needsUpdate, false);
    global.window.dispatchEvent(new Event("tavilga:model-performance")); assert.equal(gl.shadowMap.needsUpdate, true);
    gl.shadowMap.needsUpdate = false; render(false, {}); assert.equal(gl.shadowMap.needsUpdate, true, "editing while orbiting refreshes cached shadows");
    render(true); assert.equal(gl.shadowMap.autoUpdate, true, "furniture placement cannot freeze shadows");
    render(); assert.equal(gl.shadowMap.autoUpdate, false);
    moving = false; render(); assert.equal(gl.shadowMap.autoUpdate, true);
    moving = true; render(); assert.equal(gl.shadowMap.autoUpdate, false);
    slots.forEach(slot => slot?.cleanup?.());
    assert.equal(gl.shadowMap.autoUpdate, true); assert.equal(gl.shadowMap.needsUpdate, true);
    gl.shadowMap.needsUpdate = false; const count = invalidations;
    global.window.dispatchEvent(new Event("tavilga:model-performance"));
    assert.equal(invalidations, count, "unmount removes delivery listener");
  } finally { global.window = oldWindow; }
});

test("contact-shadow layer traversal reuses the camera-only cache but continues during furniture edits", () => {
  const THREE = require("three"), React = require("react");
  let moving = false, cursor = 0, frame, traversals = 0;
  const refs = [];
  const { RoomContactShadows } = loadSource("src/three/RoomMotionQuality.tsx", {
    react: { ...React, useRef: value => refs[cursor++] ?? (refs[cursor - 1] = { current: value }) },
    "@react-three/fiber": { useFrame: fn => { frame = fn; } },
    "@react-three/drei": { ContactShadows() {} },
    "./CameraMotionPreview": { useCameraMotionPreview: () => moving },
    "./roomContactShadowCasters": { ROOM_CONTACT_SHADOW_LAYER: 10, syncRoomContactShadowCasters() { traversals++; } },
  });
  const render = (updatingLayout = false) => { cursor = 0; RoomContactShadows({ updatingLayout }); };
  render(); refs[0].current = { children: [new THREE.OrthographicCamera()] };
  frame({ scene: {} }); frame({ scene: {} }); assert.equal(traversals, 2);
  moving = true; render(); frame({ scene: {} }); frame({ scene: {} }); assert.equal(traversals, 3);
  render(true); frame({ scene: {} }); frame({ scene: {} }); assert.equal(traversals, 5);
  moving = false; render(); frame({ scene: {} }); assert.equal(traversals, 6);
});

test("contact capture includes async furniture but excludes the room and invisible selection volumes", () => {
  const THREE = require('three');
  const { syncRoomContactShadowCasters, ROOM_CONTACT_SHADOW_LAYER } = loadSource('src/three/roomContactShadowCasters.ts');
  const scene = new THREE.Scene(), furniture = new THREE.Group();
  furniture.userData.roomContactCaster = true; scene.add(furniture);
  const wall = new THREE.Mesh(), floor = new THREE.Mesh(), roof = new THREE.Mesh();
  for (const part of [wall, floor, roof]) { part.castShadow = true; scene.add(part); }
  const receiverCamera = new THREE.OrthographicCamera(); receiverCamera.layers.set(ROOM_CONTACT_SHADOW_LAYER);
  const mainCamera = new THREE.PerspectiveCamera();
  syncRoomContactShadowCasters(scene);
  assert.ok([wall, floor, roof].every(part => !receiverCamera.layers.test(part.layers)));
  const sofa = new THREE.Mesh(); sofa.castShadow = true; furniture.add(sofa);
  const hit = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({ opacity: 0, transparent: true })); hit.castShadow = true; furniture.add(hit);
  syncRoomContactShadowCasters(scene);
  assert.equal(receiverCamera.layers.test(sofa.layers), true);
  assert.equal(receiverCamera.layers.test(hit.layers), false);
  assert.ok([wall, floor, roof, sofa, hit].every(part => mainCamera.layers.test(part.layers)));
  sofa.castShadow = false; syncRoomContactShadowCasters(scene);
  assert.equal(receiverCamera.layers.test(sofa.layers), false);
  for (const part of [wall, floor, roof, sofa, hit]) { part.geometry.dispose(); part.material.dispose(); }
});

test("empty shadow captures clear transparent while the visible room background stays opaque", async () => {
  const THREE = require('three');
  const { pathToFileURL } = require('node:url');
  const path = require('node:path');
  const { WebGLBackground } = await import(pathToFileURL(path.resolve('node_modules/three/src/renderers/webgl/WebGLBackground.js')).href);
  let alpha;
  const renderer = { xr: { getEnvironmentBlendMode() {} }, getRenderTarget: () => null, outputColorSpace: THREE.SRGBColorSpace, clear() {} };
  const state = { buffers: { color: { setClear(_r, _g, _b, a) { alpha = a; }, setMask() {} }, depth: { setTest() {}, setMask() {} } } };
  const background = WebGLBackground(renderer, {}, {}, state, {}, false, true);
  const scene = new THREE.Scene();
  background.render(scene); assert.equal(alpha, 1, 'opaque renderer default reproduces the full dark rectangle');
  background.setClearAlpha(0);
  background.render(scene); assert.equal(alpha, 0, 'empty offscreen pixels must not darken the floor');
  scene.background = new THREE.Color('#f1f0ed');
  background.render(scene); assert.equal(alpha, 1, 'main scene background still covers the canvas');
});
