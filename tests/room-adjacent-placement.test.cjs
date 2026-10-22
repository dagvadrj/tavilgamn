const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const layout = loadSource('src/lib/roomLayout.ts');
const room = (id, x = 0, z = 0, width = 5, depth = 4) => ({
  id, name: id, type: 'living', position: { x, z }, width, depth, height: 2.7,
  wallColor: '#eee', floorColor: '#cca', pieces: [],
});

test('new rooms use a free adjacent wall and preserve shared connections through save and undo', () => {
  const a = room('a');
  const b = layout.placeAdjacentRoom(room('b', 0, 0, 4, 3), [a], 'a');
  assert.equal(layout.roomsOverlap(a, b), false);
  assert.ok(layout.roomContacts(a, b).length);
  const c = layout.placeAdjacentRoom(room('c', 0, 0, 4, 3), [a, b], 'a');
  assert.ok([a, b].every(r => !layout.roomsOverlap(r, c)));
  assert.ok(layout.roomContacts(a, c).length);

  const oldWindow = global.window, oldStorage = global.localStorage, saved = new Map();
  global.localStorage = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: key => saved.delete(key),
  };
  global.window = { localStorage: global.localStorage };
  try {
    const { useDesigns: store } = loadSource('src/store/designs.ts');
    store.getState().createNew('80', 'Rooms', 'living', { width: 5, depth: 4, height: 2.7 });
    const primary = store.getState().current.activeRoomId;
    store.getState().addRoom('bedroom');
    const current = store.getState().current;
    assert.equal(current.rooms.length, 2);
    assert.equal(current.connections.length, 1);
    assert.equal(layout.validConnections(current.rooms, current.connections).length, 1);
    store.getState().undo();
    assert.equal(store.getState().current.rooms.length, 1);
    assert.equal(store.getState().current.connections.length, 0);
    store.getState().redo();
    assert.equal(store.getState().current.rooms.length, 2);
    assert.equal(store.getState().current.connections.length, 1);
    store.getState().selectRoom(primary);
    assert.deepEqual(store.getState().current.rooms.map(layout.roomPosition), current.rooms.map(layout.roomPosition));
    store.getState().saveCurrent();
    store.getState().loadDesign(current.id);
    assert.equal(store.getState().current.connections.length, 1);
    assert.equal(store.getState().past.length, 0);
  } finally {
    global.window = oldWindow;
    global.localStorage = oldStorage;
  }
});
