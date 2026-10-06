const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");

function browser(existing = false) {
  const previous = { window: global.window, document: global.document, customElements: global.customElements };
  let script = null, registered = false, requests = 0;
  function element() {
    const listeners = new Map();
    return { dataset: {}, addEventListener(type, handler) { listeners.set(type, handler); },
      removeEventListener(type) { listeners.delete(type); },
      remove() { script = null; }, emit(type) { listeners.get(type)?.(); } };
  }
  if (existing) script = element();
  global.window = { setTimeout, clearTimeout };
  global.customElements = { get: () => registered ? function Viewer() {} : undefined };
  global.document = { querySelector: () => script, createElement: element, head: { appendChild(next) { script = next; requests++; } } };
  return { get script() { return script; }, get requests() { return requests; }, register() { registered = true; },
    restore() { global.window = previous.window; global.document = previous.document; global.customElements = previous.customElements; } };
}

test("AR loads once on demand, deduplicates parallel requests and can retry after a failed download", async () => {
  const env = browser();
  try {
    const { loadProductModelViewer } = loadSource("src/lib/modelViewer.ts");
    assert.equal(env.requests, 0);
    const first = loadProductModelViewer();
    assert.equal(loadProductModelViewer(), first);
    assert.equal(env.requests, 1);
    env.script.emit("error");
    await assert.rejects(first, /ачаалсангүй/);
    assert.equal(env.script, null);
    const retry = loadProductModelViewer();
    assert.equal(env.requests, 2);
    assert.ok(env.script.src.startsWith("https://ajax.googleapis.com/"));
    env.register(); env.script.emit("load");
    await retry;
    await loadProductModelViewer();
    assert.equal(env.requests, 2);
  } finally { env.restore(); }
});

test("a failed existing kitchen viewer script cannot trap product AR retries", async () => {
  const env = browser(true);
  try {
    const { loadProductModelViewer } = loadSource("src/lib/modelViewer.ts");
    const request = loadProductModelViewer();
    assert.equal(env.requests, 0);
    env.script.emit("load");
    await assert.rejects(request, /бэлэн болоогүй/);
    assert.equal(env.script, null);
    const retry = loadProductModelViewer();
    assert.equal(env.requests, 1);
    env.register(); env.script.emit("load");
    await retry;
  } finally { env.restore(); }
});
