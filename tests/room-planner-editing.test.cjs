const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');
const { resizeRoomSegment } = loadSource('src/lib/roomWallEditing.ts');
const { getRoomGeometry } = loadSource('src/lib/roomGeometry.ts');
const { createOpening, validateRoomOpenings, validateOpening } = loadSource('src/lib/roomOpenings.ts');
const { configureAddedRoom } = loadSource('src/lib/addRoomOptions.ts');
const room = { width: 5, depth: 4, height: 2.7, openings: [], wallFeatures: [], columns: [] };
const near = (a, b) => assert.ok(Math.abs(a - b) < .00001, `${a} != ${b}`);
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...React.Children.toArray(n.props?.children).flatMap(nodes)];

test('numeric plan editing resizes every rectangle and L-room segment to the requested length', () => {
  for (const shape of [room, { ...room, wallFeatures: [{ id: 'l', kind: 'inset', wall: 'north', offset: 0, length: 1.75, depth: 1.4 }] }]) {
    const segments = getRoomGeometry(shape).segments.filter(s => !s.hole);
    segments.forEach((s, index) => {
      const result = resizeRoomSegment(shape, index, s.length + .2);
      assert.equal(result.error, null);
      near(getRoomGeometry(result.room).segments.filter(s => !s.hole)[index].length, s.length + .2);
      assert.equal(validateRoomOpenings(result.room), null);
    });
  }
  for (const invalid of [NaN, 0, -1, 21]) assert.ok(resizeRoomSegment(room, 0, invalid).error);
});

test('edge-distance controls calculate the opening centre from either end on all four walls', () => {
  const { OpeningEdgeDistance } = loadSource('src/features/room-planner/components/OpeningQuickEditor.tsx');
  for (const wall of ['north', 'east', 'south', 'west']) {
    const opening = createOpening('door-single', wall);
    let changed;
    const fields = nodes(OpeningEdgeDistance({ room, opening, onChange: v => changed = v, beginEdit() {}, endEdit() {} })).filter(n => n.type?.name === 'RoomMeasureInput');
    assert.equal(fields.length, 2);
    fields[0].props.onChange(60);
    const length = wall === 'north' || wall === 'south' ? 5 : 4;
    near(changed.position * length - opening.width / 2, .6);
    assert.equal(validateOpening(room, changed), null);
    fields[1].props.onChange(75);
    near(length - changed.position * length - opening.width / 2, .75);
  }
});

test('guided setup preserves explicit shape, opening dimensions and positions without legacy defaults', () => {
  const door = { ...createOpening('door-single', 'south'), position: .3, width: 1 };
  const options = { name: 'L', width: 5, depth: 4, height: 2.7, door: true, window: true, doorWall: 'north', windowWall: 'north', openings: [door], wallFeatures: [{ id: 'l', kind: 'inset', wall: 'north', offset: 0, length: 1.75, depth: 1.4 }] };
  const result = configureAddedRoom({ ...room, id: 'r', name: 'r', type: 'living', position: { x: 0, z: 0 }, pieces: [], wallColor: '#fff', floorColor: '#fff' }, options);
  assert.deepEqual(result.openings, [door]);
  assert.equal(result.wallFeatures.length, 1);
  near(getRoomGeometry(result).area, 17.55);
  const empty = configureAddedRoom(result, { ...options, openings: [] });
  assert.equal(empty.openings.length, 0);
  assert.equal(empty.connectionKind, 'open');
});

test('measurement inputs convert mm to the stored centimetre contract and reject out-of-range edits', () => {
  let cursor = 0, unit = 'мм', value = 90;
  const slots = [];
  const { RoomMeasureInput } = loadSource('src/features/room-planner/components/RoomMeasureInput.tsx', {
    react: { ...React, useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], v => slots[i] = v]; } },
    '@/features/room-planner/components/RoomMeasureUnit': { useRoomMeasureUnit: selector => selector({ unit }) },
  });
  const render = () => { cursor = 0; return nodes(RoomMeasureInput({ label: 'width', value, min: 30, max: 500, onChange: v => value = v, beginEdit() {}, endEdit() {} })); };
  const input = () => render().find(n => n.type === 'input');
  assert.equal(input().props.value, 900);
  input().props.onChange({ target: { value: '1200' } }); input().props.onBlur(); near(value, 120);
  unit = 'см'; assert.equal(input().props.value, 120);
  input().props.onChange({ target: { value: '-10' } }); input().props.onBlur(); near(value, 120);
  assert.ok(render().some(n => n.props?.role === 'alert'));
});
