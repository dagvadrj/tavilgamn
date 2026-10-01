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
