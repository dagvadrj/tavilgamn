const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");
const story = loadSource("src/features/home-interior/homeStory.ts");

test("scrolling back from the settled room replays the journey and restores the grounded hero", () => {
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
    const motion = refs[2].current;
    const scroll = position => { top = position; listeners.get("scroll")(); frame(); };
    assert.equal(motion.progress, 0);
    scroll(76-800*story.STORY_SCROLL_SCREENS);
    assert.equal(motion.progress, 1);
    scroll(-5000);
    assert.equal(motion.progress, 1, "further downward scroll keeps the sofa planted");
    scroll(76-400*story.STORY_SCROLL_SCREENS);
    assert.equal(motion.progress, .5, "reverse scroll must not retain the maximum progress");
    scroll(76);
    assert.equal(motion.progress, 0);
    assert.ok(story.storyPose(motion.progress, 0).sofaY>story.SOFA_GROUND_Y);
    assert.deepEqual(story.storyPose(motion.progress, 0), story.storyPose(motion.progress, 1));
    scroll(76-800*story.STORY_SCROLL_SCREENS);
    assert.equal(story.storyPose(motion.progress).landed, true, "a second downward journey still lands");
    scroll(76);
    assert.equal(motion.progress, 0, "returning to the top restores the reversible journey");
  } finally {
    cleanup?.();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  }
});

test("camera walks through the doorway while furniture lands independently and stays on one floor", () => {
  assert.ok(story.storyPose(0).sofaY>1);
  assert.equal(story.storyPose(.2).sofaY,story.SOFA_GROUND_Y);
  assert.ok(story.storyPose(.48).bedY>.8);
  assert.equal(story.storyPose(.7).bedY,story.JOURNEY_PLACEMENTS.bed.position[1]);
  assert.equal(story.storyPose(.79).wardrobeVisible,false);
  for (const progress of [1, 1.5, 100]) {
    const pose = story.storyPose(progress, 1000);
    assert.equal(pose.sofaY, story.SOFA_GROUND_Y);
    assert.equal(pose.wardrobeY,story.JOURNEY_PLACEMENTS.wardrobe.position[1]);
    assert.equal(pose.landed, true);
    assert.deepEqual(pose, story.storyPose(progress, 1));
  }
  for (let p = 0; p <= 1; p += .001) {
    const pose = story.storyPose(p), next = story.storyPose(Math.min(1, p + .001));
    assert.ok(pose.eye[1]>=1.3&&pose.eye[1]<=1.6,'camera remains at human eye level');
    assert.ok(pose.eye.every((v,i)=>Math.abs(v-next.eye[i])<.08),'no teleporting');
    if(Math.abs(pose.eye[2]+3.5)<.15)assert.ok(pose.eye[0]>1.6&&pose.eye[0]<2.9,'camera crosses the actual doorway');
    if(p>.2)assert.equal(pose.sofaY,story.SOFA_GROUND_Y,'sofa stays in the living room');
    if(p>.7)assert.equal(pose.bedY,story.JOURNEY_PLACEMENTS.bed.position[1],'bed stays put during wardrobe reveal');
  }
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

test("hero sleeps at rest and renders only until pointer or scroll motion settles", () => {
  const React = require('react'), THREE = require('three');
  let tick, invalidations = 0;
  const camera = new THREE.PerspectiveCamera(46, 16 / 9, .1, 60);
  const { default: InteriorScene } = loadSource('src/features/home-interior/InteriorScene.tsx', {
    react: { ...React, useMemo: fn => fn(), useRef: value => ({ current: value }), useEffect() {} },
    '@react-three/fiber': { Canvas: 'canvas', useThree: () => ({ camera, gl:{shadowMap:{}}, invalidate: () => invalidations++, size: { width: 1280, height: 720 } }), useFrame: fn => { tick = fn; } },
    './roomMaterials': { useRoomMaterials: () => ({}) },
  });
  const motion = { current: { progress: 0, pointer: { x: 0, y: 0 }, swap: -1, visible: true } };
  const props = { motion, theme: story.INTERIOR_STYLES[0], reduced: false, onStatus() {} };
  const scene = React.Children.toArray(InteriorScene(props).props.children.props.children).find(node=>node.type.name==='Scene');
  scene.type(scene.props);
  const frame = () => tick({ clock: { elapsedTime: 100 } }, 1 / 60);
  frame(); assert.equal(invalidations, 0, 'a grounded idle hero must not run a permanent RAF');
  motion.current.progress = .1; frame(); assert.ok(invalidations > 0);
  for (let i = 0; i < 180; i++) frame();
  const afterPointer = invalidations; for (let i = 0; i < 30; i++) frame(); assert.equal(invalidations, afterPointer);
  motion.current.progress = .45; frame(); assert.ok(invalidations > afterPointer);
  for (let i = 0; i < 240; i++) frame();
  const afterScroll = invalidations; for (let i = 0; i < 30; i++) frame(); assert.equal(invalidations, afterScroll);
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
  for (const text of ["Гэр гэдэг", "Скандинав", "Тохижуулалтын санаа", "Дэлгүүр бүртгүүлэх хүсэлт", "3D аялал эхлүүлэх"]) assert.ok(html.includes(text), text);
  assert.equal(html.includes("Дөрвөн мэдрэмж"), false);
  assert.equal(html.includes("interior-design-panel"), false);
  for (const text of ["62 мянга", "98%", "Долоон жилийн", "240+"]) assert.ok(!html.includes(text), text);
  assert.ok(html.includes('href="/catalog"'));
  assert.ok(html.includes('href="/planner"'));
  assert.equal(html.includes("3D түр боломжгүй"), false);
  assert.ok(html.includes("Интерьерийн санаа"));
  assert.equal(html.includes("Нийт 4.2"), false);
});

test("hotspots reveal real details with hover, touch and keyboard and close on Escape or blur", () => {
  const React = require('react'); let open = false;
  const { InteriorHotspot } = loadSource('src/features/home-interior/InteriorHotspot.tsx', {
    react: { ...React, useId: () => 'sofa-hotspot', useRef: () => ({ current: null }), useEffect() {},
      useState: () => [open, next => { open = typeof next === 'function' ? next(open) : next; }],
    },
  });
  const props = { title: 'Luna', detail: '2,890,000 ₮-өөс', href: '/product/real-product' };
  const render = () => InteriorHotspot(props);
  const parts = tree => React.Children.toArray(tree.props.children);
  let tree = render(); assert.equal(parts(tree)[1].props.hidden, true);
  tree.props.onPointerEnter({ pointerType: 'mouse' }); tree = render();
  assert.equal(parts(tree)[0].props['aria-expanded'], true);
  assert.equal(parts(tree)[0].props['aria-controls'], 'sofa-hotspot');
  assert.equal(parts(tree)[1].props.hidden, false);
  const detail = parts(parts(tree)[1]);
  assert.equal(detail[0].props.children, 'Luna'); assert.equal(detail[1].props.children, props.detail);
  assert.equal(detail[2].props.href, props.href);
  tree.props.onKeyDown({ key: 'Escape', stopPropagation() {} }); tree = render();
  assert.equal(parts(tree)[1].props.hidden, true);
  parts(tree)[0].props.onClick(); tree = render();
  assert.equal(parts(tree)[1].props.hidden, false, 'touch opens details before navigating');
  tree.props.onPointerLeave({ pointerType: 'touch' }); assert.equal(open, true);
  tree.props.onBlurCapture({ currentTarget: { contains: () => false }, relatedTarget: null }); assert.equal(open, false);
  tree.props.onFocusCapture(); assert.equal(open, true);
  tree.props.onPointerLeave({ pointerType: 'mouse' }); assert.equal(open, false);
});

test("admin navigation requires both a signed-in user and the admin role", () => {
  const React = require('react'); let state = { user: null, role: 'admin' }, mounted = true;
  const { ShopRoleLinks } = loadSource('src/components/ShopHeaderActions.tsx', {
    react: { ...React, useState: () => [mounted, () => {}], useEffect() {} },
    '@/store/auth': { useAuth: select => select(state) },
    'next/link': { default: 'link' },
  });
  assert.equal(ShopRoleLinks(), null, 'a stale role after sign-out must not show admin navigation');
  state = { user: { id: 'customer' }, role: 'customer' }; assert.equal(ShopRoleLinks(), null);
  state = { user: { id: 'admin' }, role: 'admin' }; assert.equal(ShopRoleLinks().props.href, '/admin');
  mounted = false; assert.equal(ShopRoleLinks(), null, 'server output must not expose a role-specific link');
});

test("homepage admin mutation rejects unauthenticated, malformed and non-sofa choices and detects stale writes", async () => {
  let allowed = false, writes = 0, validProduct = true, conflict = false;
  const rows = [], roleId = '11111111-1111-4111-8111-111111111111';
  let roleCategory = 'bed', roleModel = true;
  const db = { from(name) {
    assert.equal(name, "homepage_scene_settings");
    return {
      insert(row) { writes++; rows.push(row); return { select() { return { single: async () => ({ data: { version: row.version }, error: conflict ? { code: "23505" } : null }) }; } }; },
      update(row) { writes++; rows.push(row); return { eq() { return this; }, select() { return { maybeSingle: async () => ({ data: conflict ? null : { version: row.version }, error: null }) }; } }; },
    };
  } };
  const route = loadSource("src/app/api/admin/homepage/route.ts", {
    "@/lib/supabase/requireAdmin": { requireAdmin: async () => allowed ? { userId: "admin", error: null } : { error: new Response("Denied", { status: 401 }) } },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
    "@/lib/catalogServer": { readProduct: async id => id === roleId ? {category:roleCategory,model:roleModel?{id:'model'}:undefined} : ({ category: validProduct ? "sofa" : "bed", model: { id: "model" } }) },
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
  assert.equal(Object.hasOwn(rows.at(-1),'bed_product_id'),false,'legacy writes preserve an existing bed selection');
  assert.equal((await route.PUT(request({...body,bedProductId:roleId}))).status,200);
  assert.equal(rows.at(-1).bed_product_id,roleId);
  roleCategory='wardrobe';
  assert.equal((await route.PUT(request({...body,bedProductId:roleId}))).status,422);
  roleModel=false;
  assert.equal((await route.PUT(request({...body,wardrobeProductId:roleId}))).status,422);
  roleModel=true;
  assert.equal((await route.PUT(request({...body,wardrobeProductId:roleId,bedProductId:null}))).status,200);
  assert.equal(rows.at(-1).bed_product_id,null,'explicit null clears a role selection');
  assert.equal(rows.at(-1).wardrobe_product_id,roleId);
  conflict = true;
  assert.equal((await route.PUT(request(body))).status, 409);
  assert.equal((await route.PUT(request({ ...body, version: 4 }))).status, 409);
});


test("journey furniture uses only explicit, public, correctly categorized models", () => {
  const {resolveJourneyProduct} = loadSource("src/features/home-interior/InteriorHome.tsx", {"next/dynamic": {default: () => () => null}});
  const bed = {id:"bed",category:"bed",model:{id:"model"}}, wardrobe={id:"wardrobe",category:"wardrobe",model:{id:"model"}};
  const catalog=[bed,wardrobe,{id:"unavailable",category:"bed"}];
  assert.equal(resolveJourneyProduct(catalog,"wardrobe",null),undefined,"unconfigured slots remain authored interior demos");
  assert.equal(resolveJourneyProduct(catalog,"bed","bed"),bed);
  assert.equal(resolveJourneyProduct(catalog,"wardrobe","wardrobe"),wardrobe);
  assert.equal(resolveJourneyProduct(catalog,"bed","wardrobe"),undefined);
  assert.equal(resolveJourneyProduct(catalog,"bed","unavailable"),undefined);
  assert.equal(resolveJourneyProduct(catalog,"bed","deleted"),undefined);
});

test("self-hosted interior props fit a mobile geometry and download budget", async () => {
  const fs=require('node:fs');
  const {NodeIO}=await import('@gltf-transform/core'),{ALL_EXTENSIONS}=await import('@gltf-transform/extensions');
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const manifest=JSON.parse(fs.readFileSync('public/interior/sources.json','utf8'));
  let bytes=0;
  for(const asset of manifest.assets){
    const file='public/interior/'+asset.file;bytes+=fs.statSync(file).size;
    assert.equal(asset.license,'CC0-1.0');
    if(!asset.file.endsWith('.glb'))continue;
    const doc=await io.read(file);
    const triangles=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((n,p)=>n+(p.getIndices()?.getCount()??p.getAttribute('POSITION').getCount())/3,0);
    assert.ok(triangles<12000,asset.file+' has '+triangles+' triangles');
  }
  assert.ok(bytes<4*1024*1024,'shared room assets must remain below 4 MiB');
});
