const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { createSuggestedKitchen } = loadSource("src/lib/kitchenSuggestions.ts");
const { planKitchenServices, coversPoint } = loadSource("src/lib/kitchenServices.ts");

const room = (water, vent) => ({ width: 3600, depth: 3000, height: 2600, items: [
  { id: "water", kind: "water", wall: "back", x: water, z: 0, width: 100, depth: 100 },
  { id: "vent", kind: "vent", wall: "back", x: vent, z: 0, width: 120, depth: 100 },
] });
const prefs = { oven: "under-worktop", hood: "wall", refrigerator: "none", layout: "straight" };
const dims = { width: 3.6, depth: 3, height: 2.6 };

test("the sink follows the water point and the hob with its hood follows the vent", () => {
  for (const [water, vent] of [[500, 3100], [3100, 500]]) {
    const kitchen = createSuggestedKitchen(prefs, dims, { room: room(water, vent) });
    const sink = kitchen.cabinets.find(c => c.opening === "sink");
    const hob = kitchen.cabinets.find(c => c.opening === "oven" || c.opening === "hob");
    const hood = kitchen.cabinets.find(c => c.opening === "hood");
    assert.ok(Math.abs(sink.position.x - water) < Math.abs(hob.position.x - water), "sink is the closer one to water");
    assert.ok(Math.abs(hob.position.x - vent) < Math.abs(sink.position.x - vent), "hob is the closer one to the vent");
    assert.equal(hood.position.x, hob.position.x, "hood stays over the hob");
    // Prep worktop between sink and hob.
    assert.ok(Math.abs(sink.position.x - hob.position.x) - (sink.width + hob.width) / 2 >= 400);
  }
});

test("without supply points the arrangement is unchanged", () => {
  const plain = createSuggestedKitchen(prefs, dims);
  const surveyed = createSuggestedKitchen(prefs, dims, { room: { width: 3600, depth: 3000, height: 2600, items: [] } });
  assert.deepEqual(surveyed.cabinets.map(c => c.position), plain.cabinets.map(c => c.position));
});

test("worktop sockets keep clear of the hob and sink and are cut into the splashback", () => {
  const kitchen = { ...createSuggestedKitchen(prefs, dims, { room: room(500, 3100) }), backsplash: true };
  const plan = planKitchenServices(kitchen);
  const sockets = plan.points.filter(p => p.kind === "socket" || p.kind === "socket-double");
  assert.ok(sockets.length >= 1);
  for (const socket of sockets) {
    assert.equal(socket.onBacksplash, true);
    assert.equal(socket.hidden, false);
    for (const c of kitchen.cabinets.filter(c => c.opening === "sink" || c.opening === "oven" || c.opening === "hob"))
      assert.ok(Math.abs(socket.x - c.position.x) >= c.width / 2 + 150, `${socket.id} clear of ${c.opening}`);
  }
});

test("the 32 A cooker outlet sits low behind the next unit, not behind the oven, and shows as covered", () => {
  const kitchen = createSuggestedKitchen(prefs, dims, { room: room(500, 3100) });
  const plan = planKitchenServices(kitchen);
  const outlet = plan.points.find(p => p.kind === "cooker-outlet");
  const oven = kitchen.cabinets.find(c => c.opening === "oven");
  assert.ok(outlet && outlet.hidden);
  assert.equal(outlet.y, 300);
  assert.ok(!coversPoint(oven, outlet), "never behind the oven's heat");
  assert.ok(plan.points.some(p => p.kind === "water-cold" && p.hidden) && plan.points.some(p => p.kind === "drain"));
});

test("the hood duct runs to the vent and missing points become notes", () => {
  const kitchen = createSuggestedKitchen(prefs, dims, { room: room(500, 3100) });
  const [duct] = planKitchenServices(kitchen).ducts;
  const end = duct.points.at(-1);
  assert.ok(Math.abs(end.x - 3100) < 1 && end.z === 90);
  assert.ok(duct.length > 0 && duct.bends >= 1);
  const bare = planKitchenServices(createSuggestedKitchen(prefs, dims));
  assert.ok(bare.notes.some(n => n.code === "water" && n.severity === "warning"));
  assert.ok(bare.notes.some(n => n.code === "vent"));
  assert.equal(bare.ducts.length, 0);
});
