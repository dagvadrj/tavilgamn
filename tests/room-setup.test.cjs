const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const setup = loadSource("src/lib/roomSetup.ts");
const { ROOM_TYPES, getRoomGeometry } = loadSource("src/lib/roomGeometry.ts");

test("account room survives leaving mid-edit and a full reload without manual saving", () => {
  const previousStorage = global.localStorage, previousWindow = global.window;
  const saved = new Map();
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  global.localStorage = storage; global.window = { localStorage: storage };
  try {
    const original = loadSource("src/store/designs.ts");
    original.setDesignOwner("room-owner");
    const state = original.useDesigns.getState;
    state().createNew("80", "Миний өрөө", "bedroom", { width: 4.5, depth: 3.5, height: 2.7 });
    state().addRoom("office");
    state().beginEdit();
    state().updateRoom({ wallColor: "#abc123" });
    const id = state().current.id;
    // A browser reload can interrupt a drag before any exit handler runs.
    const interrupted = loadSource("src/store/designs.ts");
    interrupted.setDesignOwner("room-owner");
    assert.equal(interrupted.useDesigns.getState().current.id, id);
    assert.equal(interrupted.useDesigns.getState().current.wallColor, "#abc123");
    assert.equal(interrupted.useDesigns.getState().current.rooms.length, 2);
    // The pagehide/unmount handler also archives the current project.
    state().endEdit(); state().saveCurrent();
    const reopened = loadSource("src/store/designs.ts");
    reopened.setDesignOwner("room-owner");
    const restored = reopened.useDesigns.getState();
    assert.equal(restored.current.id, id);
    assert.equal(restored.current.wallColor, "#abc123");
    assert.equal(restored.designs.find(design => design.id === id).rooms.length, 2);
    reopened.setDesignOwner("another-owner");
    assert.equal(reopened.useDesigns.getState().current, null);
    reopened.setDesignOwner("room-owner");
    assert.equal(reopened.useDesigns.getState().current.id, id);
    reopened.useDesigns.getState().deleteDesign(id);
    reopened.useDesigns.getState().saveCurrent();
    const afterDeletion = loadSource("src/store/designs.ts");
    afterDeletion.setDesignOwner("room-owner");
    assert.equal(afterDeletion.useDesigns.getState().current, null);
    assert.equal(afterDeletion.useDesigns.getState().designs.some(design => design.id === id), false);
  } finally {
    global.localStorage = previousStorage; global.window = previousWindow;
  }
});

test("every room type offers distinct valid areas and a matching default", () => {
  assert.deepEqual(Object.keys(setup.ROOM_SIZE_SUGGESTIONS).sort(), Object.keys(ROOM_TYPES).sort());
  for (const [type, options] of Object.entries(setup.ROOM_SIZE_SUGGESTIONS)) {
    assert.equal(new Set(options.map(room => room.width * room.depth)).size, options.length);
    for (const size of options) {
      const dimensions = { ...size, height: 2.7 };
      assert.equal(setup.validateRoomSetup(dimensions), null);
      assert.equal(getRoomGeometry(dimensions).area, size.width * size.depth);
    }
    const recommended = options[setup.suggestedRoomIndex(type)];
    assert.equal(recommended.width, ROOM_TYPES[type].width);
    assert.equal(recommended.depth, ROOM_TYPES[type].depth);
  }
});

test("custom room dimensions reject empty, nonfinite and out-of-range values", () => {
  for (const patch of [{ width: 0 }, { width: NaN }, { depth: Infinity }, { depth: 20.01 }, { height: 0 }, { height: 2.39 }, { height: 3.01 }]) {
    assert.ok(setup.validateRoomSetup({ width: 4, depth: 3, height: 2.7, ...patch }));
  }
  assert.equal(setup.validateRoomSetup({ width: 1, depth: 20, height: 2.4 }), null);
});

test("starting with custom dimensions persists the new room and archives the unsaved previous room", () => {
  const previousStorage = global.localStorage, previousWindow = global.window;
  const saved = new Map();
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  global.localStorage = storage; global.window = { localStorage: storage };
  try {
    const { useDesigns } = loadSource("src/store/designs.ts");
    useDesigns.getState().createNew("80", "Өмнөх ажил", "living");
    useDesigns.getState().updateRoom({ wallColor: "#aabbcc" });
    const previous = useDesigns.getState().current;
    let writes = 0;
    const unsubscribe = useDesigns.subscribe(() => writes++);
    useDesigns.getState().createNew("80", "Унтлагын өрөө", "bedroom", { width: 3.75, depth: 4.25, height: 2.8 });
    unsubscribe();
    assert.equal(writes, 1);
    const current = useDesigns.getState().current;
    assert.equal(current.roomType, "bedroom");
    assert.deepEqual([current.width, current.depth, current.height], [3.75, 4.25, 2.8]);
    assert.deepEqual([current.rooms[0].width, current.rooms[0].depth, current.rooms[0].height], [3.75, 4.25, 2.8]);
    assert.equal(useDesigns.getState().past.length, 0);
    assert.equal(useDesigns.getState().designs[0].id, previous.id);
    const restored = loadSource("src/store/designs.ts").useDesigns.getState().current;
    assert.deepEqual([restored.width, restored.depth, restored.height], [3.75, 4.25, 2.8]);
    assert.throws(() => useDesigns.getState().createNew("80", "Invalid", "living", { width: 0, depth: 4, height: 2.7 }));
    assert.equal(useDesigns.getState().current.id, current.id);
    useDesigns.getState().loadDesign(previous.id);
    assert.equal(useDesigns.getState().current.name, "Өмнөх ажил");
    assert.equal(useDesigns.getState().current.wallColor, "#aabbcc");
  } finally {
    global.localStorage = previousStorage; global.window = previousWindow;
  }
});
