const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { kitchenDaylight } = loadSource("src/lib/kitchenDaylight.ts");

const room = { width: 4000, depth: 3000, height: 2700 };
const window = (wall, x, z, width = 1200) => ({
  id: `w-${wall}-${width}`, kind: "window", wall, x, z, width, height: 1200, sillHeight: 900,
});

test("kitchen without a window keeps the previous high front-right sun", () => {
  const light = kitchenDaylight({ ...room, items: [] });
  assert.equal(light.windowId, null);
  assert.deepEqual(light.position, [5, 7.7, 5.5]);
  assert.deepEqual(light.target, [2, 0.9, 1.5]);
});

test("kitchen sun shines through the widest window from outside and the camera faces it", () => {
  const cases = { back: [2000, 0], right: [4000, 1500], front: [2000, 3000], left: [0, 1500] };
  const outward = { back: [0, -1], right: [1, 0], front: [0, 1], left: [-1, 0] };
  for (const [wall, [x, z]] of Object.entries(cases)) {
    const narrow = window(wall, x, z, 600), wide = window(wall, x, z, 1500);
    const light = kitchenDaylight({ ...room, items: [narrow, wide, { id: "d", kind: "door", wall, x, z, width: 2000 }] });
    assert.equal(light.windowId, wide.id, wall);
    assert.deepEqual(light.target, [x / 1000, 1.5, z / 1000], wall);
    const [dx, dy, dz] = light.position.map((value, i) => value - light.target[i]);
    assert.ok(dy > 0, `${wall}: sun above the window`);
    const [ox, oz] = outward[wall];
    assert.ok(dx * ox + dz * oz > 0, `${wall}: sun is outside the room`);
    assert.ok(Math.abs(dx * oz - dz * ox) > 0.5, `${wall}: beam is slanted, not square-on`);
    assert.ok(Math.abs(Math.hypot(...light.cameraSide) - 1) < 1e-9);
    assert.ok(light.cameraSide[0] * ox + light.cameraSide[1] * oz < 0, `${wall}: camera opens opposite the window`);
  }
});
