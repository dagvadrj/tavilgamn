const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");

function setup(mobile) {
  const previous = { document: global.document, window: global.window };
  const trigger = { isConnected: true, focus() { document.activeElement = this; } };
  const first = { getClientRects: () => [1], focus() { document.activeElement = this; } };
  const last = { getClientRects: () => [1], focus() { document.activeElement = this; } };
  const hidden = { getClientRects: () => [], focus() { throw Error("hidden control focused"); } };
  const panel = new EventTarget(), media = new EventTarget(), attrs = new Map();
  media.matches = mobile;
  panel.querySelectorAll = () => [hidden, first, last];
  panel.setAttribute = (name, value) => attrs.set(name, value);
  panel.removeAttribute = name => attrs.delete(name);
  global.document = { body: { style: { overflow: "auto" } }, activeElement: trigger };
  global.window = { matchMedia: () => media };
  let effect, closed = 0;
  const { usePlannerPanel } = loadSource("src/features/planner/components/usePlannerPanel.ts", {
    react: { useRef: value => ({ current: value }), useEffect: fn => { effect = fn; } },
  });
  const ref = usePlannerPanel(true, () => closed++); ref.current = panel;
  const cleanup = effect();
  return { first, last, trigger, attrs, media,
    key(key, shiftKey = false) {
      const event = new Event("keydown", { cancelable: true }); Object.assign(event, { key, shiftKey });
      panel.dispatchEvent(event); return event.defaultPrevented;
    },
    get closed() { return closed; },
    dispose() { cleanup(); global.document = previous.document; global.window = previous.window; },
  };
}

test("mobile planner inspectors trap focus, dismiss with Escape and restore the triggering control", () => {
  const h = setup(true);
  try {
    assert.equal(document.activeElement, h.first);
    assert.equal(h.attrs.get("aria-modal"), "true");
    assert.equal(document.body.style.overflow, "hidden");
    h.key("Tab", true); assert.equal(document.activeElement, h.last);
    h.key("Tab"); assert.equal(document.activeElement, h.first);
    assert.equal(h.key("Escape"), true); assert.equal(h.closed, 1);
    h.media.matches = false; h.media.dispatchEvent(new Event("change"));
    assert.equal(document.activeElement, h.trigger);
    assert.equal(document.body.style.overflow, "auto");
    assert.equal(h.attrs.has("aria-modal"), false);
  } finally { h.dispose(); }
});

test("desktop planner inspectors remain non-modal and activate mobile focus handling when resized", () => {
  const h = setup(false);
  try {
    assert.equal(document.activeElement, h.trigger); assert.equal(h.attrs.size, 0);
    assert.equal(h.key("Escape"), false); assert.equal(h.closed, 0);
    h.media.matches = true; h.media.dispatchEvent(new Event("change"));
    assert.equal(document.activeElement, h.first); assert.equal(h.attrs.get("role"), "dialog");
  } finally { h.dispose(); }
});
