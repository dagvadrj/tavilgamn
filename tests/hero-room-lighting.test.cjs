const test = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');
const layout = loadSource('src/features/home-interior/heroRoomLayout.ts');
const { HERO_ROOM: room, HERO_WINDOW: window, HERO_SUN: sun, HERO_MEDIA_WALL: panel } = layout;

test('Hero sun reaches the floor through a real window aperture; opaque wall still blocks other rays', () => {
  const sections = layout.heroBackWallSections();
  const boxes = sections.map(part => new THREE.Box3().setFromCenterAndSize(
    new THREE.Vector3(part.x, part.y, room.backZ), new THREE.Vector3(part.width, part.height, .16)));
  const source = new THREE.Vector3().fromArray(sun.position), destination = new THREE.Vector3().fromArray(sun.target);
  const ray = new THREE.Ray(source, destination.clone().sub(source).normalize());
  const opening = ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), -room.backZ), new THREE.Vector3());
  assert.ok(opening.x > window.x - window.width / 2 && opening.x < window.x + window.width / 2);
  assert.ok(opening.y > window.bottom && opening.y < window.top);
  assert.ok(boxes.every(box => ray.intersectBox(box, new THREE.Vector3()) === null));
  const blocked = new THREE.Ray(source, new THREE.Vector3(3, 0, 0).sub(source).normalize());
  assert.ok(boxes.some(box => blocked.intersectBox(box, new THREE.Vector3())));
  const area = sections.reduce((sum, part) => sum + part.width * part.height, 0);
  assert.ok(Math.abs(area - (room.width * room.height - window.width * (window.top - window.bottom))) < 1e-9);
});

test('media wall and evenly spaced slats leave the daylight window clear', () => {
  assert.ok(panel.x - panel.width / 2 > window.x + window.width / 2);
  const positions = layout.heroSlatPositions();
  assert.ok(positions.length > 30 && positions.length < 80);
  assert.ok(positions.every(x => x - panel.slatWidth / 2 >= panel.x - panel.width / 2 && x + panel.slatWidth / 2 <= panel.x + panel.width / 2));
  for (let index = 1; index < positions.length; index++) assert.ok(Math.abs(positions[index] - positions[index - 1] - panel.slatPitch) < 1e-9);
});

test('TV wall sconces light upward and downward without adding per-lamp shadow maps', () => {
  const { TimberMediaWall } = loadSource('src/features/home-interior/HeroRoomFeatures.tsx', {
    react: { ...React, useMemo: fn => fn(), useRef: () => ({ current: null }), useLayoutEffect() {} },
    '@react-three/fiber': { useThree: select => select({ invalidate() {} }) },
  });
  const nodes = tree => !React.isValidElement(tree) ? [] : [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)];
  const tree = TimberMediaWall({ materials: {} });
  const sconces = nodes(tree).filter(node => typeof node.type === 'function' && node.type.name === 'UpDownSconce');
  assert.equal(sconces.length, 2);
  for (const sconce of sconces) {
    const lights = nodes(sconce.type(sconce.props)).filter(node => node.type === 'spotLight');
    assert.equal(lights.length, 2);
    for (const light of lights) {
      assert.ok(light.props.intensity > 0);
      assert.notEqual(light.props.castShadow, true);
    }
    assert.ok(lights[0].props.target.position.y > lights[0].props.position[1]);
    assert.ok(lights[1].props.target.position.y < lights[1].props.position[1]);
  }
  assert.equal(nodes(tree).filter(node => node.type === 'instancedMesh').length, 1);
});
