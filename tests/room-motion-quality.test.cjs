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
  moving = true; render(); assert.equal(dpr, 1);
  moving = false; render(); assert.equal(dpr, 1.5);
  configuredDpr = 1; moving = true; render(); moving = false; render(); assert.equal(dpr, 1, "mobile cap survives interaction");
  configuredDpr = 0.75; moving = true; render(); assert.equal(dpr, 0.75);
  const unmount = effects[1](); unmount(); assert.equal(dpr, 0.75);
  state.viewport.initialDpr = 0; render(); assert.equal(values.at(-1), 0.75);
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
