const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const { summarizeFrames } = loadSource("src/lib/performanceDiagnostics.ts");
const { animateToward } = loadSource("src/three/demandAnimation.ts");

test("on-demand animation stays awake until settled and clamps long idle gaps", () => {
  assert.deepEqual(animateToward(1, 1, 12, 0.016), { value: 1, moving: false });
  assert.equal(animateToward(0, 1, 12, 10).moving, true);
  assert.deepEqual(animateToward(0, 1, 12, 10), animateToward(0, 1, 12, 0.1));
  let current = 0, iterations = 0, moving = true;
  while (moving && iterations++ < 1000) {
    const next = animateToward(current, 1, 12, 1 / 60);
    current = next.value; moving = next.moving;
  }
  assert.equal(current, 1);
  assert.equal(moving, false);
  assert.ok(iterations < 1000);
});

test("frame summary separates idle render rate from active animation FPS", () => {
  assert.deepEqual(summarizeFrames([16, 16, 2000, 16], 3, 2000), { renderFps: 2, activeFps: 63 });
  assert.deepEqual(summarizeFrames([], 0, 2000), { renderFps: 0, activeFps: null });
  assert.deepEqual(summarizeFrames([NaN, Infinity, -1, 0, 300], 1, 2000), { renderFps: 1, activeFps: null });
});

test("model metrics retain a bounded local history without relying on network", () => {
  const oldWindow = global.window;
  global.window = { dispatchEvent() {} };
  const oldRate = process.env.NEXT_PUBLIC_MODEL_METRICS_SAMPLE_RATE;
  process.env.NEXT_PUBLIC_MODEL_METRICS_SAMPLE_RATE = "0";
  try {
    const { reportModelPerformance, getRecentModelMetrics } = loadSource("src/lib/modelPerformance.ts");
    for (let i = 0; i < 60; i++) reportModelPerformance({
      asset: `asset-${i}.glb`, variant: "preview", readyMs: 12.3,
      totalReadyMs: 20.7, cacheHit: false, queueMs: 0, loadDecodeMs: 10,
      resourceDurationMs: null, encodedBodySize: null,
    });
    const values = getRecentModelMetrics();
    assert.equal(values.length, 50);
    assert.equal(values[0].asset, "asset-10.glb");
    assert.equal(values[0].readyMs, 12);
    assert.equal(values[0].totalReadyMs, 21);
    values.length = 0;
    assert.equal(getRecentModelMetrics().length, 50);
  } finally {
    global.window = oldWindow;
    if (oldRate === undefined) delete process.env.NEXT_PUBLIC_MODEL_METRICS_SAMPLE_RATE;
    else process.env.NEXT_PUBLIC_MODEL_METRICS_SAMPLE_RATE = oldRate;
  }
});

test("extended metric API accepts cache timings but rejects invalid diagnostic fields", async () => {
  const { POST } = loadSource("src/app/api/model-metrics/route.ts");
  const oldInfo = console.info;
  console.info = () => {};
  const metric = { asset: "/model.glb", variant: "high", readyMs: 40, queueMs: 0,
    loadDecodeMs: 20, resourceDurationMs: null, encodedBodySize: null,
    totalReadyMs: 80, cacheHit: true };
  const post = value => POST({ headers: new Headers(), nextUrl: { origin: "https://shop.example" },
    body: new Response(JSON.stringify(value)).body });
  try {
    assert.equal((await post(metric)).status, 204);
    assert.equal((await post({ ...metric, totalReadyMs: -1 })).status, 400);
    assert.equal((await post({ ...metric, cacheHit: "yes" })).status, 400);
  } finally { console.info = oldInfo; }
});
