const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const THREE = require("three");
const { loadSource } = require("./helpers/load-source.cjs");

function harness(supported = true) {
  const previous = { window: global.window, document: global.document, HTMLElement: global.HTMLElement, URL: global.URL, setTimeout: global.setTimeout, clearTimeout: global.clearTimeout };
  const timers = new Set(), intervals = new Set(), revoked = [];
  let focused = false, launches = 0, exports = 0;
  class Element extends EventTarget {
    focus() { focused = true; }
  }
  class Viewer extends Element {
    ar = false;
    loaded = false;
    get canActivateAR() { return Boolean(this.ar) && this.loaded && supported; }
    activateAR() { launches++; return Promise.resolve(); }
    load() { this.loaded = true; this.dispatchEvent(new Event("load")); }
  }
  const element = new Viewer(), dialog = { showModal() {}, close() {} };
  global.HTMLElement = Element;
  global.document = { activeElement: new Element() };
  global.window = { setInterval: fn => { intervals.add(fn); return fn; }, clearInterval: fn => intervals.delete(fn) };
  global.setTimeout = fn => { timers.add(fn); return fn; };
  global.clearTimeout = fn => timers.delete(fn);
  global.URL = { createObjectURL: () => "blob:selected-product", revokeObjectURL: url => revoked.push(url) };
  const slots = [];
  let cursor = 0, dirty = true, effects = [], tree;
  const react = { ...React,
    useRef(value) { return slots[cursor++] ??= { current: value }; },
    useState(value) {
      const i = cursor++, slot = slots[i] ??= { value };
      return [slot.value, next => { const value = typeof next === "function" ? next(slot.value) : next; if (!Object.is(value, slot.value)) { slot.value = value; dirty = true; } }];
    },
    useEffect(effect, deps) {
      const i = cursor++, previous = slots[i];
      if (!previous || deps.some((value, index) => !Object.is(value, previous.deps[index]))) {
        effects.push(() => { previous?.cleanup?.(); slots[i] = { deps, cleanup: effect() }; });
      }
    },
  };
  const { ProductAR } = loadSource("src/components/ProductAR.tsx", {
    react,
    "@/lib/modelViewer": { loadProductModelViewer: () => Promise.resolve() },
    "@/three/productExport": { exportProductForAR: () => { exports++; return Promise.resolve(new Blob(["product"])); } },
  });
  const scene = new THREE.Group(); scene.userData.appearanceReady = true;
  function find(node, predicate) {
    if (!React.isValidElement(node)) return null;
    if (predicate(node)) return node;
    for (const child of React.Children.toArray(node.props.children)) { const found = find(child, predicate); if (found) return found; }
    return null;
  }
  function render() {
    cursor = 0; dirty = false; effects = [];
    tree = ProductAR({ scene, name: "Sofa", selectionKey: "cream:fabric", close() {} });
    tree.props.ref.current = dialog;
    const viewer = find(tree, node => node.type === "model-viewer");
    if (viewer) {
      // React 19 sets an existing custom-element property directly, not as an attribute.
      for (const [key, value] of Object.entries(viewer.props)) if (key in element) element[key] = value;
      viewer.props.ref(element);
    }
    const pending = effects; effects = []; pending.forEach(effect => effect());
  }
  async function flush() {
    for (let i = 0; i < 8; i++) {
      if (dirty) render();
      await new Promise(resolve => setImmediate(resolve));
      for (const timer of [...timers]) { timers.delete(timer); timer(); }
    }
  }
  return { element, flush,
    button() { const footer = find(tree, node => node.props.className === "pdp-ar-footer"); return find(footer, node => node.type === "button"); },
    get launches() { return launches; }, get exports() { return exports; }, get focused() { return focused; }, revoked,
    dispose() {
      try { slots.forEach(slot => slot?.cleanup?.()); assert.equal(intervals.size, 0); }
      finally { for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete global[key]; else global[key] = value; } }
    },
  };
}

test("React 19 product AR passes a boolean property, enables Quick Look after load and launches synchronously on tap", async () => {
  const env = harness();
  try {
    await env.flush();
    assert.equal(env.exports, 1);
    assert.equal(env.element.ar, true);
    assert.equal(env.button().props.disabled, true);
    env.element.load(); await env.flush();
    assert.equal(env.button().props.disabled, false);
    env.button().props.onClick();
    assert.equal(env.launches, 1, "native AR activation must retain the tap's user gesture");
    await env.flush();
  } finally { env.dispose(); }
  assert.deepEqual(env.revoked, ["blob:selected-product"]);
  assert.equal(env.focused, true);
});

test("product AR stays disabled on devices without an available AR mode", async () => {
  const env = harness(false);
  try {
    await env.flush(); env.element.load(); await env.flush();
    assert.equal(env.button().props.disabled, true);
    env.button().props.onClick();
    assert.equal(env.launches, 0);
  } finally { env.dispose(); }
});
