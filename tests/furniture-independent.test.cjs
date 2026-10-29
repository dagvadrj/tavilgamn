const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");
const { furnitureIndependent, furnitureIndependentSignature: sig } = loadSource("src/three/furnitureIndependent.tsx");

const design = (patch = {}) => ({ id: "d", width: 4, depth: 5, wallColor: "#fff", pieces: [{ instanceId: "a", x: 0 }],
  rooms: [{ id: "r", pieces: [{ instanceId: "a", x: 0 }], lighting: { fixtures: [] } }], updatedAt: 1, ...patch });

test("moving furniture leaves the room signature unchanged; room edits change it", () => {
  const base = sig({ design: design(), view: "perspective", onSelect() {} });
  const moved = design({ pieces: [{ instanceId: "a", x: 2 }], updatedAt: 2, previewImage: "data:" });
  moved.rooms[0].pieces = [{ instanceId: "a", x: 2 }];
  assert.equal(sig({ design: moved, view: "perspective", onSelect: () => {} }), base, "furniture, timestamps and new callbacks ignored");
  assert.notEqual(sig({ design: design({ wallColor: "#000" }), view: "perspective", onSelect() {} }), base);
  assert.notEqual(sig({ design: design(), view: "plan", onSelect() {} }), base);
  assert.notEqual(sig({ design: design(), view: "perspective" }), base, "a handler appearing or disappearing is a change");
});

test("wrapped components render the same output and call the latest handler", () => {
  let calls = [];
  const View = ({ design, onSelect }) => { onSelect(design.wallColor); return React.createElement("i", null, design.wallColor); };
  const Wrapped = furnitureIndependent(View);
  const html = renderToStaticMarkup(React.createElement(Wrapped, { design: design(), onSelect: v => calls.push(v) }));
  assert.equal(html, "<i>#fff</i>");
  assert.deepEqual(calls, ["#fff"]);
});
