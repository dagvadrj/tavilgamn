const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const story = loadSource("src/features/home-interior/homeStory.ts");

test("scrolling back from the settled room replays the journey and restores floating", () => {
  const React = require("react");
  const refs = [], effects = [];
  const { InteriorHome } = loadSource("src/features/home-interior/InteriorHome.tsx", {
    react: { ...React,
      useRef: value => { const ref = { current: value }; refs.push(ref); return ref; },
      useState: value => [value, () => {}],
      useCallback: callback => callback,
      useEffect: effect => effects.push(effect),
    },
    "next/dynamic": { default: () => () => null },
  });
  InteriorHome({ catalog: [], stores: [], paymentLabels: [] });
  let top = 76, frame;
  const listeners = new Map();
  refs[0].current = {
    style: { getPropertyValue: () => "76" },
    getBoundingClientRect: () => ({ top }),
  };
  refs[1].current = { clientHeight: 800 };
  const previous = Object.fromEntries(["window", "IntersectionObserver", "requestAnimationFrame", "cancelAnimationFrame"].map(key => [key, global[key]]));
  global.window = { innerHeight: 876, addEventListener: (name, listener) => listeners.set(name, listener), removeEventListener: name => listeners.delete(name) };
  global.IntersectionObserver = class { observe() {} disconnect() {} };
  global.requestAnimationFrame = callback => { frame = callback; return 1; };
  global.cancelAnimationFrame = () => {};
  let cleanup;
  try {
    cleanup = effects[2]();
    const motion = refs[3].current;
    const scroll = position => { top = position; listeners.get("scroll")(); frame(); };
    assert.equal(motion.progress, 0);
    scroll(-1044);
    assert.equal(motion.progress, 1);
    scroll(-1800);
    assert.equal(motion.progress, 1, "further downward scroll keeps the sofa planted");
    scroll(-484);
    assert.equal(motion.progress, .5, "reverse scroll must not retain the maximum progress");
    motion.swap = .2;
    scroll(76);
    assert.equal(motion.progress, 0);
    assert.equal(motion.swap, -1, "leaving the placement area cancels a running replacement");
    assert.notEqual(story.storyPose(motion.progress, 0).sofaY, story.storyPose(motion.progress, 1).sofaY);
    scroll(-1044);
    assert.equal(story.storyPose(motion.progress).landed, true, "a second downward journey still lands");
  } finally {
    cleanup?.();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  }
});

test("sofa completes exactly one turn before camera travel and lands with no perpetual bob", () => {
  assert.equal(story.storyPose(0).rotation, 0);
  assert.equal(story.storyPose(.3).rotation, Math.PI * 2);
  assert.equal(Math.abs(story.storyPose(.3).cameraY), 0);
  assert.equal(story.storyPose(.62).cameraY, story.LOWER_ROOM_Y);
  for (const progress of [1, 1.5, 100]) {
    const pose = story.storyPose(progress, 1000);
    assert.equal(pose.sofaY, story.LOWER_ROOM_Y + .055);
    assert.equal(pose.rotation, Math.PI * 2);
    assert.equal(pose.landed, true);
    assert.deepEqual(pose, story.storyPose(progress, 1));
  }
  for (let p = .62; p <= 1; p += .001) assert.ok(story.storyPose(p).sofaY >= story.LOWER_ROOM_Y + .055 - 1e-9, "sofa never sinks through floor");
});

test("replacement swaps above the view, returns to floor and reduced motion jumps to settled scene", () => {
  assert.equal(story.replacementHeight(0), 0);
  assert.equal(story.replacementHeight(.5), 5);
  assert.equal(story.replacementHeight(1), 0);
  assert.equal(story.replacementHeight(-1), 0);
  assert.deepEqual(story.storyPose(0, 23, true), story.storyPose(1));
  assert.equal(new Set(story.INTERIOR_STYLES.map(style => style.id)).size, 4);
  assert.deepEqual([...new Set(story.INTERIOR_STYLES.map(style => style.product))], [0, 1]);
});

test("homepage settings require exactly two distinct UUIDs and a valid revision", () => {
  const { parseHomepageSettings, defaultHomepageSettings } = loadSource("src/lib/homepageSettings.ts");
  assert.deepEqual(parseHomepageSettings(defaultHomepageSettings()), defaultHomepageSettings());
  for (const value of [null, {}, { productIds: [], version: 0 }, { productIds: [story.HOME_PRODUCT_IDS[0], story.HOME_PRODUCT_IDS[0]], version: 0 }, { productIds: story.HOME_PRODUCT_IDS, version: -1 }, { productIds: story.HOME_PRODUCT_IDS, version: "0" }, { productIds: ["../../secret", story.HOME_PRODUCT_IDS[1]], version: 0 }]) assert.equal(parseHomepageSettings(value), null);
});

test("public homepage renders editorial content and controls without waiting for catalog or WebGL", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { InteriorHome } = loadSource("src/features/home-interior/InteriorHome.tsx", {
    "next/dynamic": { default: () => () => null },
    "next/image": { default: ({ alt }) => React.createElement("span", { "aria-label": alt }) },
    "next/link": { default: ({ href, children, ...props }) => React.createElement("a", { href, ...props }, children) },
  });
  const html = renderToStaticMarkup(React.createElement(InteriorHome, { catalog: [], stores: [], paymentLabels: [], dataError: true }));
  for (const text of ["Гэр гэдэг", "Скандинав", "Модерн", "Дулаан", "Минимал", "Бидний төслүүд", "Долоон жилийн", "Дэлгүүрээ нээх", "Өрөөнд байрлуулах"]) assert.ok(html.includes(text), text);
  assert.ok(html.includes('href="/catalog"'));
  assert.ok(html.includes('href="/planner"'));
  assert.ok(html.includes("3D түр боломжгүй"));
});

test("homepage admin mutation rejects unauthenticated, malformed and non-sofa choices and detects stale writes", async () => {
  let allowed = false, writes = 0, validProduct = true, conflict = false;
  const db = { from(name) {
    assert.equal(name, "homepage_scene_settings");
    return {
      insert(row) { writes++; return { select() { return { single: async () => ({ data: { version: row.version }, error: conflict ? { code: "23505" } : null }) }; } }; },
      update(row) { writes++; return { eq() { return this; }, select() { return { maybeSingle: async () => ({ data: conflict ? null : { version: row.version }, error: null }) }; } }; },
    };
  } };
  const route = loadSource("src/app/api/admin/homepage/route.ts", {
    "@/lib/supabase/requireAdmin": { requireAdmin: async () => allowed ? { userId: "admin", error: null } : { error: new Response("Denied", { status: 401 }) } },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
    "@/lib/catalogServer": { readProduct: async () => ({ category: validProduct ? "sofa" : "bed", model: { id: "model" } }) },
    "@/lib/homepageSettingsServer": { readHomepageSettings: async () => ({ productIds: [...story.HOME_PRODUCT_IDS], version: 0 }) },
    "@/lib/publicCatalog": { readCachedProducts: async () => [] },
  });
  const request = (body) => new Request("http://localhost/api/admin/homepage", { method: "PUT", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });
  const body = { productIds: [...story.HOME_PRODUCT_IDS], version: 0 };
  assert.equal((await route.PUT(request(body))).status, 401);
  assert.equal(writes, 0);
  allowed = true;
  assert.equal((await route.PUT(request("{"))).status, 400);
  assert.equal((await route.PUT(request({ ...body, productIds: [] }))).status, 400);
  validProduct = false;
  assert.equal((await route.PUT(request(body))).status, 422);
  assert.equal(writes, 0);
  validProduct = true;
  assert.equal((await route.PUT(request(body))).status, 200);
  conflict = true;
  assert.equal((await route.PUT(request(body))).status, 409);
  assert.equal((await route.PUT(request({ ...body, version: 4 }))).status, 409);
});
