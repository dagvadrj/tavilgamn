const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { createCabinet, createModularKitchen } = loadSource("src/lib/kitchenCabinets.ts");
const { kitchenRoomFit, placeKitchenInRoom } = loadSource("src/lib/kitchenRoomChoice.ts");

const kitchen = (room, cabinets) => ({ ...createModularKitchen(), room, cabinets });

test("room fit names what is short", () => {
  const need = { widthMm: 3200, depthMm: 2500, heightMm: 2400 };
  assert.equal(kitchenRoomFit(need, { width: 3400, depth: 3000, height: 2700 }).fits, true);
  const short = kitchenRoomFit(need, { width: 3000, depth: 3000, height: 2300 });
  assert.equal(short.fits, false);
  assert.match(short.message, /өргөн 200 мм/);
  assert.match(short.message, /өндөр 100 мм/);
});

test("a run on the right wall stays on the right wall in a wider room", () => {
  const cabinet = createCabinet("base", "a", 600);
  cabinet.position = { ...cabinet.position, x: 2700 };
  const design = kitchen({ width: 3000, depth: 3000, height: 2600 }, [cabinet]);
  const placed = placeKitchenInRoom(design, { width: 4000, depth: 3500, height: 2700, items: [] });
  assert.equal(placed.cabinets[0].position.x, 3700);
  assert.equal(placed.cabinets[0].position.z, cabinet.position.z);
  assert.equal(placed.room.width, 4000);
});

test("a corner run stays in the corner and ceiling units follow the new ceiling", () => {
  const base = createCabinet("base", "a", 600);
  const tall = createCabinet("tall", "b", 600, 2600);
  tall.position = { ...tall.position, x: 900 };
  const design = kitchen({ width: 3000, depth: 3000, height: 2600 }, [base, tall]);
  const placed = placeKitchenInRoom(design, { width: 3500, depth: 3200, height: 2500 });
  assert.equal(placed.cabinets[0].position.x, base.position.x);
  assert.equal(placed.cabinets[1].height, 2500);
});

test("a run wider than the room is refused", () => {
  const left = createCabinet("base", "a", 600);
  const right = createCabinet("base", "b", 600);
  right.position = { ...right.position, x: 2700 };
  const design = kitchen({ width: 3000, depth: 3000, height: 2600 }, [left, right]);
  assert.equal(placeKitchenInRoom(design, { width: 2000, depth: 3000, height: 2600 }), null);
});

test("wall cabinets outside the counter gap return to automatic elevation", () => {
  const placement = loadSource("src/lib/kitchenPlacement.ts");
  const base = createCabinet("base", "a", 600);
  const high = createCabinet("wall", "b", 600);
  high.position = { ...high.position, z: high.depth / 2, y: 840 + 30 + 677 };
  high.autoElevation = false;
  const design = kitchen({ width: 3000, depth: 3000, height: 2600 }, [base, high]);
  const settled = placement.settleWallCabinets(design);
  assert.equal(settled.cabinets[1].autoElevation, true);
  const resolved = placement.resolveElevations(settled);
  assert.equal(resolved.cabinets[1].position.y, 840 + design.countertop.thickness + design.wallClearance);
  const fine = placement.settleWallCabinets(resolved);
  assert.equal(fine, resolved);
});
