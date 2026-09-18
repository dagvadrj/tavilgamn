const assert = require("node:assert/strict");
const { test } = require("node:test");
const { loadSource } = require("../../tests/helpers/load-source.cjs");

const products = {
  square: {
    dimensions: {
      w: 1,
      d: 1,
    },
  },
  sofa: {
    dimensions: {
      w: 3,
      d: 1,
    },
  },
};

const collision = loadSource("src/three/collision.ts", {
  "@/store/catalog": {
    getProduct: (id) => products[id],
  },
  "@/lib/modelRegistry": {
    getDbModel: () => undefined,
  },
});

const piece = (overrides = {}) => ({
  instanceId: "one",
  productId: "square",
  x: 0,
  z: 0,
  rotation: 0,
  color: "oak",
  material: "wood",
  ...overrides,
});

const room = {
  width: 6,
  depth: 5,
};

test("placement searches deterministically from the requested position and avoids occupied space", () => {
  const original = piece();

  const copy = piece({
    instanceId: "two",
  });

  const result = collision.findFreePlacement(copy, [original], room);

  assert.ok(result);

  assert.ok(collision.isPlacementValid(result, [original], room));

  assert.deepEqual(result, collision.findFreePlacement(copy, [original], room));

  assert.deepEqual(original, piece());
});

test("a full room returns no placement; oversized and invalid coordinates are rejected", () => {
  assert.equal(
    collision.findFreePlacement(
      piece({
        instanceId: "two",
      }),
      [piece()],
      {
        width: 1,
        depth: 1,
      },
    ),
    null,
  );

  assert.equal(
    collision.isPlacementValid(
      piece({
        productId: "sofa",
      }),
      [],
      {
        width: 2,
        depth: 2,
      },
    ),
    false,
  );

  assert.equal(
    collision.isPlacementValid(
      piece({
        x: NaN,
      }),
      [],
      room,
    ),
    false,
  );

  assert.equal(
    collision.isPlacementValid(
      piece({
        rotation: Infinity,
      }),
      [],
      room,
    ),
    false,
  );
});

test("rotation matches the Three.js Y axis and catches diagonal overlap", () => {
  const sofa = piece({
    productId: "sofa",
    rotation: Math.PI / 4,
  });

  assert.equal(collision.rectFor(sofa).rot, -Math.PI / 4);

  const onSofa = piece({
    instanceId: "two",
    x: 0.9,
    z: -0.9,
  });

  const outsideSofa = piece({
    instanceId: "two",
    x: 1.2,
    z: 1.2,
  });

  assert.equal(collision.isPlacementValid(onSofa, [sofa], room), false);

  assert.equal(collision.isPlacementValid(outsideSofa, [sofa], room), true);
});

test("rotated wall snap remains inside room bounds despite floating point rounding", () => {
  const sofa = piece({
    productId: "sofa",
    x: 2,
    z: 0.9,
    rotation: Math.PI / 3,
  });

  const snapped = collision.snapToWall(sofa, room);

  assert.ok(collision.isPlacementValid(snapped, [], room));

  assert.notEqual(snapped.x, sofa.x);
});

test("history groups dragging, branches safely, preserves saved versions, and isolates owners", () => {
  const memory = new Map();

  global.localStorage = {
    getItem: (key) => memory.get(key) ?? null,

    setItem: (key, value) => memory.set(key, value),

    removeItem: (key) => memory.delete(key),
  };

  global.window = {
    localStorage: global.localStorage,
  };

  try {
    const { useDesigns, setDesignOwner } = loadSource("src/store/designs.ts");

    const state = () => useDesigns.getState();

    state().createNew("80", "Test room");

    state().updatePieces([piece()]);

    state().saveCurrent();

    const savedId = state().current.id;

    state().beginEdit();

    state().updatePieces([
      piece({
        x: 0.1,
      }),
    ]);

    state().updatePieces([
      piece({
        x: 0.2,
      }),
    ]);

    state().updatePieces([
      piece({
        x: 0.3,
      }),
    ]);

    state().endEdit();

    assert.equal(state().past.length, 2);

    state().undo();

    assert.equal(state().current.pieces[0].x, 0);

    state().redo();

    assert.equal(state().current.pieces[0].x, 0.3);

    assert.equal(state().designs[0].pieces[0].x, 0);

    state().undo();

    state().updateRoom({
      width: 7,
      depth: 4,
    });

    assert.equal(state().future.length, 0);

    state().undo();

    assert.equal(state().current.width, 8.9);

    const previousLength = state().past.length;

    state().beginEdit();
    state().endEdit();

    assert.equal(state().past.length, previousLength);

    const persisted = JSON.parse(memory.get("casa-designs-guest")).state;

    assert.deepEqual(Object.keys(persisted).sort(), ["current", "designs"]);

    state().loadDesign(savedId);

    assert.equal(state().past.length, 0);

    state().updateRoom({
      wallColor: "#ffffff",
    });

    setDesignOwner("other-user");

    assert.equal(state().current, null);

    assert.equal(state().past.length, 0);

    assert.equal(state().future.length, 0);

    state().undo();

    assert.equal(state().current, null);
  } finally {
    delete global.localStorage;
    delete global.window;
  }
});
