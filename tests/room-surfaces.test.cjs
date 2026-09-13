const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const openings = loadSource('src/lib/roomOpenings.ts');
const rooms = loadSource('src/lib/roomDesign.ts');
const shape = { width: 5, depth: 4, height: 2.7 };
const legacy = () => ({ id: 'saved', name: 'Миний өрөө', size: '40', ...shape, wallColor: '#aabbcc', floorColor: '#ccbbaa', pieces: [], createdAt: 1, updatedAt: 1 });
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.000001, `${a} != ${b}`);
const door = (wallId = 'north', position = .5) => openings.createOpening('door-single', wallId, position);
const windowOpening = (wallId = 'north', position = .5) => openings.createOpening('window-fixed', wallId, position);

function decorated() {
  return rooms.syncDesignRooms({ ...legacy(), floorMaterial: 'parquet-walnut', ceilingMaterial: 'ceiling-plaster',
    wallMaterials: { north: { mode: 'wallpaper', color: '#efeedd', materialId: 'wallpaper-stripe' } },
    lighting: { mode: 'evening', ambient: .3, sunlight: .2, fixtures: [{ id: 'lamp', x: 1, z: -.5, intensity: 3, color: '#fff1d6' }] },
    openings: [door()],
  });
}

function memoryStore(saved = new Map()) {
  const previousStorage = global.localStorage, previousWindow = global.window;
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  global.localStorage = storage;
  global.window = { localStorage: storage };
  const module = loadSource('src/store/designs.ts');
  return { ...module, saved, restore() { global.localStorage = previousStorage; global.window = previousWindow; } };
}

test('opening templates have unique IDs, safe dimensions, and independent instance IDs', () => {
  assert.equal(new Set(openings.OPENING_TEMPLATES.map(t => t.id)).size, 4);
  for (const template of openings.OPENING_TEMPLATES) for (const wall of ['north', 'east', 'south', 'west']) {
    const opening = openings.createOpening(template.id, wall);
    assert.equal(opening.wallId, wall); assert.equal(opening.kind, template.kind);
    assert.equal(openings.validateOpening(shape, opening), null);
    assert.notEqual(opening.id, openings.createOpening(template.id, wall).id);
  }
  assert.throws(() => openings.createOpening('missing', 'north'));
});

test('normalized wall coordinates and local directions remain clockwise on all four walls', () => {
  const expected = { north: [-1.25, -2, 1, 0, 0, 1], east: [2.5, -1, 0, 1, -1, 0], south: [1.25, 2, -1, 0, 0, -1], west: [-2.5, 1, 0, -1, 1, 0] };
  for (const [wall, [x, z, dx, dz, nx, nz]] of Object.entries(expected)) {
    const world = openings.openingWorldTransform(shape, door(wall, .25));
    near(world.x, x); near(world.z, z);
    near(Math.cos(world.rotation), dx); near(-Math.sin(world.rotation), dz);
    near(Math.sin(world.rotation), nx); near(Math.cos(world.rotation), nz);
  }
});

test('frames must fit walls and ceiling, including exact boundary and room resize cases', () => {
  const margin = openings.OPENING_FRAME_MARGIN;
  const boundary = { ...door(), position: (.45 + margin) / shape.width };
  assert.equal(openings.validateOpening(shape, boundary), null);
  assert.ok(openings.validateOpening(shape, { ...boundary, position: boundary.position - .001 }));
  assert.ok(openings.validateOpening(shape, { ...door(), width: 5 }));
  assert.equal(openings.validateOpening({ ...shape, height: 2.1 + margin }, door()), null);
  assert.ok(openings.validateOpening({ ...shape, height: 2.1 }, door()));
  const room = { ...shape, openings: [{ ...door(), width: 2 }] };
  assert.equal(openings.validateRoomOpenings(room), null);
  assert.ok(openings.validateRoomOpenings({ ...room, width: 2 }));
  const high = { ...windowOpening(), sillHeight: 1.4 };
  assert.equal(openings.validateRoomOpenings({ ...shape, height: 3, openings: [high] }), null);
  assert.ok(openings.validateRoomOpenings({ ...shape, height: 2.4, openings: [high] }));
});

test('opening validation rejects nonfinite dimensions, invalid model values, and duplicate IDs', () => {
  for (const key of ['width', 'height', 'sillHeight', 'position']) for (const value of [NaN, Infinity, -Infinity]) {
    assert.ok(openings.validateOpening(shape, { ...door(), [key]: value }), `${key}=${value}`);
  }
  for (const patch of [{ width: 0 }, { height: -.5 }, { sillHeight: -.1 }, { position: 1.1 }, { position: -.1 }, { wallId: 'bad' },
    { templateId: 'bad' }, { kind: 'window' }, { hinge: 'bad' }, { swing: 'bad' }, { open: 'yes' }, { id: '' }, { sillHeight: .2 }]) {
    assert.ok(openings.validateOpening(shape, { ...door(), ...patch }), JSON.stringify(patch));
  }
  const first = door('north', .25);
  assert.ok(openings.validateRoomOpenings({ ...shape, openings: [first, { ...first, position: .75 }] }));
  assert.ok(openings.validateRoomOpenings({ ...shape, width: NaN }));
  assert.ok(openings.validateRoomOpenings({ ...shape, height: Infinity }));
});

test('clear opening plus frame overlap is blocked, replacing the selected opening remains allowed', () => {
  const first = door('north', .25), second = door('north', .45);
  const room = { ...shape, openings: [first] };
  assert.ok(openings.validateOpening(room, second)); // Only frames overlap: centres are 1 m apart.
  assert.equal(openings.validateOpening(room, { ...second, position: .46 }), null);
  assert.equal(openings.validateOpening(room, { ...first, position: .4 }), null);
  assert.equal(openings.validateOpening(room, { ...second, wallId: 'south' }), null);
  const lower = { ...windowOpening(), height: .5, sillHeight: .3 };
  const upper = { ...windowOpening(), height: .5, sillHeight: 1.2 };
  assert.equal(openings.validateRoomOpenings({ ...shape, openings: [lower, upper] }), null);
  assert.ok(openings.validateOpening(shape, { ...upper, sillHeight: .85 }, [lower]));
});

test('insets and recesses remove original wall spans while unaffected wall portions remain usable', () => {
  for (const wall of ['north', 'east', 'south', 'west']) for (const kind of ['inset', 'recess']) {
    const room = { ...shape, wallFeatures: [{ id: 'feature', wall, kind, offset: 1.2, length: 1.2, depth: .4 }] };
    const removed = door(wall, 1.8 / openings.wallLength(shape, wall));
    assert.ok(openings.validateOpening(room, removed), `${wall} ${kind}`);
    assert.equal(openings.validateOpening(room, door(wall, .6 / openings.wallLength(shape, wall))), null);
    assert.ok(openings.validateRoomOpenings({ ...room, openings: [removed] }));
  }
});

test('wall-touching columns and adjacent-wall corner insets block openings at actual missing segments', () => {
  const centered = door();
  const column = { id: 'column', x: 2.2, z: 0, width: .5, depth: .4 };
  assert.ok(openings.validateOpening({ ...shape, columns: [column] }, centered));
  assert.equal(openings.validateOpening({ ...shape, columns: [{ ...column, z: 1 }] }, centered), null);
  const corner = { ...shape, wallFeatures: [{ id: 'corner', wall: 'north', kind: 'inset', offset: 0, length: .5, depth: 1.2 }] };
  assert.ok(openings.validateOpening(corner, door('west', .85)));
  assert.equal(openings.validateOpening(corner, door('west', .3)), null);
});

test('legacy migration gives every wall its old paint and independent room surface defaults', () => {
  const migrated = rooms.syncDesignRooms(legacy());
  assert.equal(migrated.floorMaterial, 'legacy'); assert.equal(migrated.floorColor, '#ccbbaa'); assert.equal(migrated.ceilingMaterial, 'ceiling-white');
  assert.deepEqual(migrated.openings, []); assert.equal(migrated.lighting.mode, 'day');
  for (const wall of ['north', 'east', 'south', 'west']) assert.deepEqual(migrated.wallMaterials[wall], { mode: 'color', color: '#aabbcc' });
  const copy = rooms.syncDesignRooms(migrated);
  copy.wallMaterials.north.color = '#000000'; copy.lighting.fixtures.push({ id: 'new', x: 0, z: 0, intensity: 1, color: '#ffffff' });
  assert.equal(migrated.wallMaterials.north.color, '#aabbcc'); assert.equal(migrated.lighting.fixtures.length, 0);
  assert.equal(rooms.DEFAULT_ROOM_LIGHTING.fixtures.length, 0);
});

test('surface and opening state survives room switching, deep cloning, and JSON roundtrip', () => {
  const first = decorated(), firstId = first.activeRoomId;
  const second = rooms.newDesignRoom('bedroom', first.rooms);
  let design = rooms.activateDesignRoom({ ...first, rooms: [...first.rooms, second] }, second.id);
  assert.equal(design.floorMaterial, 'parquet-oak'); assert.deepEqual(design.openings, []); assert.deepEqual(design.lighting.fixtures, []);
  design = rooms.syncDesignRooms({ ...design, floorMaterial: 'tile-stone', openings: [windowOpening('west')] });
  design = rooms.activateDesignRoom(design, firstId);
  assert.equal(design.floorMaterial, 'parquet-walnut'); assert.equal(design.ceilingMaterial, 'ceiling-plaster');
  assert.equal(design.wallMaterials.north.mode, 'wallpaper'); assert.equal(design.lighting.fixtures[0].x, 1); assert.equal(design.openings[0].kind, 'door');
  const parsed = rooms.syncDesignRooms(JSON.parse(JSON.stringify(design)));
  assert.deepEqual(parsed, design);
  parsed.openings[0].width = 1.8; parsed.lighting.fixtures[0].x = 20;
  assert.equal(design.openings[0].width, .9); assert.equal(design.lighting.fixtures[0].x, 1);
  const back = rooms.activateDesignRoom(design, second.id);
  assert.equal(back.floorMaterial, 'tile-stone'); assert.equal(back.openings[0].kind, 'window');
});

test('real store preserves grouped opening drags, room materials, fixtures, undo and redo', () => {
  const memory = memoryStore();
  try {
    const store = memory.useDesigns;
    store.getState().createNew('40');
    const firstId = store.getState().current.activeRoomId;
    const patch = decorated();
    store.getState().updateRoom({ floorMaterial: patch.floorMaterial, wallMaterials: patch.wallMaterials, ceilingMaterial: patch.ceilingMaterial, lighting: patch.lighting, openings: patch.openings });
    const placed = store.getState().current.openings[0];
    store.getState().beginEdit();
    store.getState().updateRoom({ openings: [{ ...placed, position: .6 }] });
    store.getState().updateRoom({ openings: [{ ...placed, position: .7 }] });
    store.getState().endEdit();
    assert.equal(store.getState().past.length, 2);
    store.getState().undo(); assert.equal(store.getState().current.openings[0].position, .5);
    store.getState().redo(); assert.equal(store.getState().current.openings[0].position, .7);
    store.getState().addRoom('bedroom');
    const secondId = store.getState().current.activeRoomId;
    store.getState().updateRoom({ floorMaterial: 'tile-stone', ceilingMaterial: 'ceiling-white' });
    store.getState().selectRoom(firstId);
    assert.equal(store.getState().current.floorMaterial, 'parquet-walnut');
    assert.equal(store.getState().current.openings[0].position, .7);
    store.getState().selectRoom(secondId);
    assert.equal(store.getState().current.floorMaterial, 'tile-stone');
    store.getState().undo(); assert.equal(store.getState().current.floorMaterial, 'parquet-oak');
    store.getState().redo(); assert.equal(store.getState().current.floorMaterial, 'tile-stone');
    store.getState().selectRoom(firstId);
    store.getState().saveCurrent('Saved surfaces');
    const savedId = store.getState().current.id;
    store.getState().updateRoom({ openings: [{ ...placed, width: 1.1 }], lighting: { ...patch.lighting, fixtures: [{ ...patch.lighting.fixtures[0], x: 2 }] } });
    assert.equal(store.getState().designs[0].openings[0].width, .9);
    assert.equal(store.getState().designs[0].lighting.fixtures[0].x, 1);
    store.getState().loadDesign(savedId);
    assert.equal(store.getState().current.openings[0].width, .9);
    store.getState().duplicateDesign(savedId);
    const duplicate = store.getState().designs[1];
    assert.notEqual(duplicate.id, savedId); assert.deepEqual(duplicate.rooms, store.getState().designs[0].rooms);
    duplicate.openings[0].width = 2;
    assert.equal(store.getState().designs[0].openings[0].width, .9);
  } finally { memory.restore(); }
});

test('persist rehydration and account switching retain new state and migrate old saves', () => {
  const persisted = new Map([['casa-designs-guest', JSON.stringify({ state: { designs: [legacy()], current: decorated() }, version: 0 })],
    ['casa-designs-member', JSON.stringify({ state: { designs: [decorated()], current: legacy() }, version: 0 })]]);
  const memory = memoryStore(persisted);
  try {
    const store = memory.useDesigns;
    assert.equal(store.getState().current.floorMaterial, 'parquet-walnut');
    assert.equal(store.getState().designs[0].wallMaterials.east.color, '#aabbcc');
    store.getState().updateRoom({ ceilingMaterial: 'ceiling-linen' });
    const saved = JSON.parse(persisted.get('casa-designs-guest')).state;
    assert.equal(saved.current.ceilingMaterial, 'ceiling-linen');
    assert.equal(saved.current.rooms[0].lighting.fixtures[0].id, 'lamp');
    assert.equal(saved.current.rooms[0].openings[0].kind, 'door');
    memory.setDesignOwner('member');
    assert.equal(store.getState().current.floorMaterial, 'legacy');
    assert.equal(store.getState().designs[0].floorMaterial, 'parquet-walnut');
    assert.deepEqual(store.getState().past, []);
    memory.setDesignOwner(null);
    assert.equal(store.getState().current.ceilingMaterial, 'ceiling-linen');
    assert.equal(store.getState().current.openings[0].kind, 'door');
  } finally { memory.restore(); }
});

test('legacy single-colour store edits remain effective and explicit material edits take precedence', () => {
  const memory = memoryStore();
  try {
    const store = memory.useDesigns;
    store.getState().createNew('40');
    assert.equal(store.getState().current.floorMaterial, 'parquet-oak');
    store.getState().updateRoom({ wallMaterials: { north: { mode: 'wallpaper', color: '#eeeeee', materialId: 'wallpaper-stripes' } } });
    // Applying the cached legacy colour must still replace a newer wallpaper.
    store.getState().updateRoom({ wallColor: store.getState().current.wallColor });
    assert.equal(store.getState().current.wallMaterials.north.mode, 'color');
    store.getState().updateRoom({ wallColor: '#123456', floorColor: '#654321' });
    assert.equal(store.getState().current.floorMaterial, 'legacy');
    assert.equal(store.getState().current.floorColor, '#654321');
    for (const wall of ['north', 'east', 'south', 'west']) assert.deepEqual(store.getState().current.wallMaterials[wall], { mode: 'color', color: '#123456' });
    const painted = { north: { mode: 'color', color: '#aa0000' } };
    store.getState().updateRoom({ wallColor: '#ababab', wallMaterials: painted, floorColor: '#000000', floorMaterial: 'parquet-birch' });
    assert.equal(store.getState().current.wallMaterials.north.color, '#aa0000');
    assert.equal(store.getState().current.floorMaterial, 'parquet-birch');
  } finally { memory.restore(); }
});

test('measured plan shows doors, windows, real positions, dimensions, and opening direction', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { RoomPlanPreview } = loadSource('src/components/RoomPlanPreview.tsx', {
    '@/store/catalog': { getProduct: () => undefined }, '@/lib/modelRegistry': { getDbModel: () => undefined },
  });
  const entry = { ...door('east', .25), swing: 'outward', hinge: 'right' };
  const window = windowOpening('south');
  const html = renderToStaticMarkup(React.createElement(RoomPlanPreview, { room: { ...shape, openings: [entry, window] } }));
  assert.match(html, /room-plan-door/); assert.match(html, /room-plan-window/);
  assert.match(html, /translate\(2.5 -1\) rotate\(90\)/);
  assert.match(html, /translate\(0 2\) rotate\(-180\)/);
  assert.match(html, /Гадагш нээгдэнэ/); assert.match(html, /900 × 2100 мм/); assert.match(html, /1200 × 1200 мм/);
  assert.match(html, /Шалнаас 900 мм/); assert.match(html, /room-plan-door-swing/);
  assert.match(html, /A0.9,0.9 0 0 1 0.45,-0.9/);
  const removed = renderToStaticMarkup(React.createElement(RoomPlanPreview, { room: shape }));
  assert.doesNotMatch(removed, /room-plan-door-swing|class="room-plan-opening/);
});
