const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');

function harness() {
  let refCursor = 0, effectCursor = 0, frame, invalidations = 0;
  const refs = [], effects = [], pending = [];
  const invalidate = () => invalidations++;
  const { useKitchenOpenAnimation } = loadSource('src/three/useKitchenOpenAnimation.ts', {
    react: { ...React, useRef: value => refs[refCursor++] ?? (refs[refCursor - 1] = { current: value }),
      useEffect(fn, deps) {
        const index = effectCursor++, old = effects[index];
        if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) pending.push(() => {
          old?.cleanup?.(); effects[index] = { deps, cleanup: fn() };
        });
      } },
    '@react-three/fiber': { useThree: select => select({ invalidate }), useFrame: fn => { frame = fn; } },
  });
  return {
    render(root, clip, open = false, motions) {
      refCursor = effectCursor = 0; useKitchenOpenAnimation(root, clip, open, motions);
      pending.splice(0).forEach(fn => fn());
    },
    frames(count) { for (let i = 0; i < count; i++) frame({}, 1 / 60); },
    invalidations: () => invalidations,
    dispose() { effects.forEach(effect => effect?.cleanup?.()); },
  };
}

test('static furniture performs no animation or media-query work during camera frames', () => {
  const oldWindow = global.window; let queries = 0;
  global.window = { matchMedia() { queries++; return { matches: false }; } };
  const h = harness();
  try {
    h.render(new THREE.Group(), undefined); const initial = h.invalidations(); h.frames(1000);
    assert.equal(queries, 0); assert.equal(h.invalidations(), initial);
  } finally { h.dispose(); global.window = oldWindow; }
});

test('doors sample only while animating, reverse correctly and apply their pose to a replacement model', () => {
  const oldWindow = global.window, originalSetTime = THREE.AnimationMixer.prototype.setTime;
  let samples = 0, queries = 0;
  global.window = { matchMedia() { queries++; return { matches: false }; } };
  THREE.AnimationMixer.prototype.setTime = function (time) { samples++; return originalSetTime.call(this, time); };
  const h = harness(), createRoot = () => { const root = new THREE.Group(), door = new THREE.Object3D(); door.name = 'Door'; root.add(door); return root; };
  const clip = new THREE.AnimationClip('Open', .45, [new THREE.NumberKeyframeTrack('Door.rotation[y]', [0, .45], [0, Math.PI / 2])]);
  let root = createRoot();
  const rotation = () => root.getObjectByName('Door').rotation.y;
  try {
    h.render(root, clip); h.frames(1); assert.equal(samples, 1); const initialQueries = queries;
    h.frames(1000); assert.equal(samples, 1); assert.equal(queries, initialQueries);
    h.render(root, clip, true); h.frames(40); assert.ok(Math.abs(rotation() - Math.PI / 2) < 1e-6);
    const opened = samples; h.frames(1000); assert.equal(samples, opened);
    root = createRoot(); h.render(root, clip, true); h.frames(1); assert.ok(Math.abs(rotation() - Math.PI / 2) < 1e-6);
    h.render(root, clip, false); h.frames(40); assert.ok(Math.abs(rotation()) < 1e-6);
    const closed = samples; h.frames(1000); assert.equal(samples, closed);
  } finally { h.dispose(); global.window = oldWindow; THREE.AnimationMixer.prototype.setTime = originalSetTime; }
});
