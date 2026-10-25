const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { advanceDemoAxis } = loadSource('src/lib/demoMotion.ts');

test('30, 60 and 120 Hz have the same pose and velocity at equal elapsed time', () => {
  const samples = [30, 60, 120].map(hz => {
    const axis = { value: -0.1, velocity: 0, target: 1.8 };
    for (let i = 0; i < hz / 2; i++) advanceDemoAxis(axis, 1 / hz);
    return axis;
  });
  for (const sample of samples.slice(1)) {
    assert.ok(Math.abs(sample.value - samples[0].value) < 1e-10);
    assert.ok(Math.abs(sample.velocity - samples[0].velocity) < 1e-10);
  }
});

test('interruptions keep the current pose and momentum; every transition settles and stops requesting frames', () => {
  const axis = { value: 0, velocity: 0, target: 1.8 };
  for (let i = 0; i < 10; i++) advanceDemoAxis(axis, 1 / 60);
  const current = { ...axis };
  axis.target = -0.3;
  assert.equal(axis.value, current.value);
  assert.equal(axis.velocity, current.velocity);
  advanceDemoAxis(axis, 1 / 120);
  assert.ok(Math.abs(axis.value - current.value) < 0.08);
  let moving = true;
  for (let i = 0; i < 180; i++) moving = advanceDemoAxis(axis, 1 / 60);
  assert.equal(moving, false);
  assert.equal(axis.value, -0.3);
  assert.equal(axis.velocity, 0);
});

test('zero velocity transitions do not overshoot; reduced motion snaps without an animation loop', () => {
  const axis = { value: 0.18, velocity: 0, target: 0 };
  for (let i = 0; i < 120; i++) {
    advanceDemoAxis(axis, 1 / 60);
    assert.ok(axis.value >= 0 && axis.value <= 0.18);
  }
  axis.target = 2;
  assert.equal(advanceDemoAxis(axis, 1 / 60, true), false);
  assert.equal(axis.value, 2);
  assert.equal(axis.velocity, 0);
});

test('a supported canvas fallback is passive and cannot report a WebGL error when React mounts it', () => {
  const React = require('react');
  const { default: ModelDemoCanvas } = loadSource('src/features/motion/ModelDemoCanvas.tsx', {
    '@react-three/fiber': { Canvas: 'canvas' },
    '@/three/modelLoader': {},
    '@/three/productSurfaceController': {},
    '@/three/canvasPerformance': { useCanvasPerformance: () => ({ dpr: 1 }) },
  });
  let errors = 0;
  const tree = ModelDemoCanvas({ visible: true, onError: () => errors++ });
  const canvas = React.Children.toArray(tree.props.children)[0];
  assert.equal(canvas.props.fallback.type, 'span');
  assert.equal(errors, 0);
});
