const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { cardImageSourceWidth } = loadSource("src/lib/cardImageResolution.ts");

test("a landscape photograph covering a portrait card requests pixels for the visible height", () => {
  const width = cardImageSourceWidth({ width: 280, height: 440, naturalWidth: 1200, naturalHeight: 800, fit: "cover" });
  assert.equal(width, 687);
  assert.ok(width > 280, "requesting only the card width would stretch the visible crop");
});

test("portrait and contain images stay bounded to their rendered width instead of fetching unnecessarily large versions", () => {
  assert.equal(cardImageSourceWidth({ width: 280, height: 350, naturalWidth: 800, naturalHeight: 1200, fit: "cover" }), 292);
  assert.equal(cardImageSourceWidth({ width: 280, height: 440, naturalWidth: 1200, naturalHeight: 800, fit: "contain" }), 292);
  assert.equal(cardImageSourceWidth({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, fit: "cover" }), 0);
});
