const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");

test("floor footprints remain dimension-specific and evict the oldest of 128 entries", () => {
  const cache = loadSource("src/lib/modelFloorBand.ts");
  const size = { w: 1, h: 2, d: 3 };
  const rects = [{ minX: -0.5, maxX: 0.5, minZ: -1.5, maxZ: 1.5 }];
  const entry = { rects, source: "delivery.glb", high: true };
  cache.cacheModelFloorBand("model", size, entry);
  assert.equal(cache.modelFloorBand("model", size), rects);
  assert.equal(cache.modelFloorBand("model", { ...size, d: 4 }), undefined);
  for (let i = 0; i < 127; i++)
    cache.cacheModelFloorBand(`other-${i}`, size, entry);
  // Replacement refreshes insertion order, matching the previous cache behavior.
  cache.cacheModelFloorBand("model", size, entry);
  cache.cacheModelFloorBand("last", size, entry);
  assert.equal(cache.modelFloorBand("other-0", size), undefined);
  assert.equal(cache.modelFloorBand("model", size), rects);
  assert.equal(
    cache.getModelFloorBandEntry("model", size).source,
    "delivery.glb",
  );
  assert.equal(cache.getModelFloorBandEntry("model", size).high, true);
});
