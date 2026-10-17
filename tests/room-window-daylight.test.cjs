const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { createOpening, openingWorldTransform } = loadSource('src/lib/roomOpenings.ts');
const shape = { width: 4, depth: 5, height: 2.7 };

test('window sky lights face inward on every wall, match the aperture and share lookup tables', () => {
  let effects = [], initialized = 0, invalidated = 0;
  const uniforms = {};
  const { RoomDaylightFill } = loadSource('src/three/RoomDaylightFill.tsx', {
    react: { ...React, useMemo: fn => fn(), useEffect: fn => effects.push(fn) },
    three: { ...THREE, UniformsLib: uniforms },
    'three-stdlib': { RectAreaLightUniformsLib: { init() { initialized++; uniforms.LTC_HALF_1 = {}; } } },
    '@react-three/fiber': { useThree: select => select({ invalidate: () => invalidated++ }) },
  });
  for (const wall of ['north', 'east', 'south', 'west']) {
    effects = [];
    const opening = createOpening('window-panoramic', wall);
    const light = RoomDaylightFill({ design: { ...shape, openings: [opening] }, daylight: 1 }).props.object;
    const p = openingWorldTransform(shape, opening);
    const inward = new THREE.Vector3(Math.sin(p.rotation), 0, Math.cos(p.rotation));
    const emission = new THREE.Vector3(0, 0, -1).applyQuaternion(light.quaternion);
    assert.ok(emission.dot(inward) > .99999);
    assert.ok(Math.abs(light.position.clone().sub(new THREE.Vector3(p.x, light.position.y, p.z)).dot(inward) - .09) < 1e-6);
    assert.equal(light.position.y, opening.sillHeight + opening.height / 2);
    assert.equal(light.width, opening.width); assert.equal(light.height, opening.height);
    assert.equal(light.castShadow, false, 'sky fill must not add another shadow pass');
    let disposed = false; light.dispose = () => { disposed = true; };
    const cleanup = effects[0](); cleanup(); assert.equal(disposed, true);
  }
  assert.equal(initialized, 1); assert.equal(invalidated, 4);
});

test('one strongest window supplies sky fill; windowless rooms get ceiling fill and night stays dark', () => {
  const { RoomDaylightFill } = loadSource('src/three/RoomDaylightFill.tsx', {
    react: { ...React, useMemo: fn => fn(), useEffect: () => {} },
    '@react-three/fiber': { useThree: select => select({ invalidate() {} }) },
  });
  const small = createOpening('window-fixed', 'north');
  const large = createOpening('window-panoramic', 'east');
  const door = createOpening('door-double', 'south');
  const design = { ...shape, openings: [small, large, door] };
  const light = RoomDaylightFill({ design, daylight: .5 }).props.object;
  assert.equal(light.width, large.width); assert.equal(light.intensity, 3.5); light.dispose();
  assert.equal(RoomDaylightFill({ design, daylight: 0 }), null);
  const fallback = RoomDaylightFill({ design: { ...shape, openings: [door] }, daylight: 1 }).props.object;
  const emission = new THREE.Vector3(0, 0, -1).applyQuaternion(fallback.quaternion);
  assert.ok(emission.y < -.99999);
  assert.equal(fallback.position.y, shape.height - .12);
  assert.ok(fallback.width <= shape.width && fallback.height <= shape.depth);
  assert.equal(fallback.castShadow, false); fallback.dispose();
});
