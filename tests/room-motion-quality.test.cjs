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
    "@react-three/fiber": {}, "@react-three/drei": { ContactShadows() {} },
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
