const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const THREE = require("three");
const { loadSource } = require("./helpers/load-source.cjs");

// Run the real component's hooks and draw callbacks without needing a GPU.
function harness(patch = {}, textureAssets = {}) {
  const slots = [], requests = [], metrics = [], released = [];
  let cursor = 0, dirty = true, effects = [], frames = [], tree;
  let motion = null;
  const renderer = {}, root = new THREE.Group();
  const props = { modelId: "model", basePath: "/models/", glbFile: "high.glb",
    previewGlbFile: "preview.glb", w: 2, h: 1, d: 1, ...patch };
  const mockedReact = { ...React,
    useState(initial) {
      const index = cursor++;
      const slot = slots[index] ??= { value: initial };
      return [slot.value, value => { slot.value = typeof value === "function" ? value(slot.value) : value; dirty = true; }];
    },
    useRef(initial) { return (slots[cursor++] ??= { current: initial }); },
    useMemo(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i])))
        slots[index] = { deps, value: fn() };
      return slots[index].value;
    },
    useEffect(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
      }
    },
  };
  const { GLBFurnitureMesh } = loadSource("src/three/GLBFurnitureMesh.tsx", {
    react: mockedReact,
    "@react-three/fiber": { useThree: selector => {
      const state = { gl: renderer, invalidate() {} };
      return selector ? selector(state) : state;
    }, useFrame: fn => { frames.push(fn); } },
    "@react-three/drei": { Edges: () => null, Html: () => null },
    "./kitchenMaterialTextures": { acquireKitchenMaterialTextures: paths => ({
      promise: Promise.resolve(Object.fromEntries(Object.entries(paths ?? {}).flatMap(([kind,url]) => textureAssets[url] ? [[kind,textureAssets[url]]] : []))),
      release() {},
    }) },
    "@/lib/modelPerformance": { reportModelPerformance: metric => metrics.push(metric) },
    "./CameraMotionPreview": { useCameraMotionPreview: () => motion },
    "./modelLoader": {
      acquireModel(_renderer, url) {
        let resolve, reject;
        const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        requests.push({ url, resolve, reject });
        return { promise, release: () => released.push(url) };
      },
      cloneModel: model => ({ ...model, scene: model.scene.clone(true) }),
      disposeModelClone() {},
    },
  });
  function render() {
    dirty = false; cursor = 0; effects = []; frames = [];
    tree = GLBFurnitureMesh(props);
    tree.props.ref.current = root;
    const pending = effects; effects = [];
    pending.forEach(effect => effect());
  }
  async function flush() {
    for (let i = 0; i < 6; i++) {
      if (dirty) render();
      await new Promise(resolve => setImmediate(resolve));
    }
  }
  function find(element, type) {
    if (!React.isValidElement(element)) return null;
    if (element.props.visible === false) return null;
    if (element.type === type) return element;
    for (const child of React.Children.toArray(element.props.children)) {
      const match = find(child, type); if (match) return match;
    }
    return null;
  }
  function resolve(index, material = new THREE.MeshStandardMaterial(), triangles, animations = []) {
    const scene = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), material);
    mesh.name = "front"; scene.add(mesh);
    requests[index].resolve({ scene, triangles, animations,
      bounds: new THREE.Box3(new THREE.Vector3(-.5,0,-.5), new THREE.Vector3(.5,1,.5)),
      metrics: { queueMs: 0, loadDecodeMs: 10, resourceDurationMs: 8, encodedBodySize: 100 } });
    return scene;
  }
  return { props, requests, metrics, released, root, flush, resolve,
    updateProps(patch) { Object.assign(props, patch); dirty = true; },
    motion(value) { motion = value; dirty = true; },
    get tree() { return tree; },
    primitive: () => find(tree, "primitive"),
    find: type => find(tree, type),
    draw() {
      const primitive = find(tree, "primitive");
      assert.ok(primitive, "a loaded model must be on screen");
      primitive.props.object.traverse(object => { if (object instanceof THREE.Mesh) object.onAfterRender(); });
    },
    camera(camera, delta = 1/60) { frames.forEach(fn => fn({ camera }, delta)); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test("authored door animation runs smoothly and reverses from its current pose", async () => {
  const clip = new THREE.AnimationClip('Open', .45, [new THREE.NumberKeyframeTrack('front.rotation[y]',[0,.45],[0,-Math.PI/2])]);
  const run = harness({openAnimation:'Open'}), camera = new THREE.PerspectiveCamera();
  try {
    await run.flush(); run.resolve(0,undefined,undefined,[clip]); await run.flush();
    const door = run.primitive().props.object.getObjectByName('front');
    run.updateProps({open:true}); await run.flush();
    run.camera(camera,.05); assert.ok(door.rotation.y < 0 && door.rotation.y > -Math.PI/2);
    const partial = door.rotation.y;
    run.updateProps({open:false}); await run.flush(); run.camera(camera,.025);
    assert.ok(door.rotation.y > partial && door.rotation.y < 0);
    for(let i=0;i<15;i++) run.camera(camera,.05);
    assert.ok(Math.abs(door.rotation.y)<1e-7);
    run.updateProps({open:true}); await run.flush(); for(let i=0;i<15;i++) run.camera(camera,.05);
    assert.ok(Math.abs(door.rotation.y+Math.PI/2)<1e-7);
    run.updateProps({open:false}); await run.flush(); for(let i=0;i<15;i++) run.camera(camera,.05);
    assert.ok(Math.abs(door.rotation.y)<1e-7,'clamped endpoint can close again');
    assert.equal(run.requests.length,1,'opening never reloads geometry');
  } finally { run.unmount(); }
});

test("only delivery is requested even with legacy preview data; readiness and metrics report once after drawing", async () => {
  const originalWindow = global.window;
  global.window = { location: { origin: "https://shop.example" } };
  let ready = 0;
  const run = harness({ onReady: () => ready++ });
  try {
    await run.flush();
    assert.deepEqual(run.requests.map(request => request.url), ["/models/high.glb"]);
    run.resolve(0); await run.flush();
    assert.equal(ready, 0);
    assert.equal(run.tree.props.userData.deliveryPending, false);
    run.draw(); await run.flush(); run.draw();
    assert.equal(ready, 1);
    assert.deepEqual(run.metrics.map(metric => metric.variant), ["high"]);
    assert.equal(run.requests.length, 1);
    assert.deepEqual(run.released, []);
  } finally { run.unmount(); global.window = originalWindow; }
  assert.deepEqual(run.released, ["/models/high.glb"]);
});

test("new furniture reserves its measured volume, remains selectable and excludes the placeholder from exports", async () => {
  const run = harness({ previewGlbFile: undefined, w: 2.4, h: .85, d: .95 });
  try {
    await run.flush();
    const placeholder = run.find("mesh");
    assert.deepEqual(placeholder.props.position, [0, .425, 0]);
    const children = React.Children.toArray(placeholder.props.children);
    assert.deepEqual(children.find(node => node.type === "boxGeometry").props.args, [2.4, .85, .95]);
    assert.equal(placeholder.props.raycast, undefined, "normal raycasting lets the parent select/drag a loading piece");
    assert.equal(placeholder.props.userData.exportExclude, true);
    assert.equal(run.tree.props.userData.deliveryPending, true);
    run.resolve(0); await run.flush();
    assert.equal(run.find("mesh"), null, "the placeholder leaves when the prepared GLB is attached");
    assert.ok(run.primitive());
  } finally { run.unmount(); }
});

test("strict catalog delivery rejects decoded size mismatches and never shows a previous SKU as its replacement", async () => {
  const originalError = console.error; console.error = () => {};
  let errors = 0;
  const run = harness({ w: 1, h: 1, d: 1, strictDimensions: true, preservePhysicalSize: true, onError: () => errors++ });
  try {
    await run.flush(); run.resolve(0); await run.flush();
    assert.ok(run.primitive()); assert.equal(run.tree.props.userData.deliveryReady, true);
    run.updateProps({ glbFile: 'wrong-size.glb', w: 2 }); await run.flush();
    assert.equal(run.primitive(), null);
    run.resolve(1); await run.flush();
    assert.equal(errors, 1); assert.equal(run.primitive(), null);
    assert.equal(run.tree.props.userData.deliveryReady, false);
    assert.ok(run.released.includes('/models/wrong-size.glb'));
  } finally { run.unmount(); console.error = originalError; }
});

test("replacement keeps the last model at its original size until the current request is ready, ignoring stale completion", async () => {
  const run = harness({ previewGlbFile: undefined });
  try {
    await run.flush(); run.resolve(0); await run.flush();
    const original = run.primitive().props.object;
    run.updateProps({ glbFile: "next.glb", w: 3 }); await run.flush();
    assert.equal(run.primitive().props.object, original);
    assert.equal(run.tree.props.children[0].props.scale[0], 2, "pending replacement must not stretch the retained model");
    assert.equal(run.tree.props.userData.deliveryReady, false);
    assert.equal(run.tree.props.userData.deliveryPending, true);
    assert.deepEqual(run.released, []);
    run.updateProps({ glbFile: "latest.glb", w: 4 }); await run.flush();
    run.resolve(1); await run.flush();
    assert.equal(run.primitive().props.object, original, "an outdated download cannot replace the visible model");
    assert.deepEqual(run.released, ["/models/next.glb"]);
    run.resolve(2); await run.flush();
    assert.notEqual(run.primitive().props.object, original);
    assert.equal(run.tree.props.children[0].props.scale[0], 4);
    assert.equal(run.tree.props.userData.deliveryPending, false);
    assert.deepEqual(run.released, ["/models/next.glb", "/models/high.glb"]);
  } finally { run.unmount(); }
  assert.deepEqual(run.released, ["/models/next.glb", "/models/high.glb", "/models/latest.glb"]);
});

test("failed replacements retain the visible model and retry without releasing it early", async () => {
  const originalError = console.error; console.error = () => {};
  const run = harness({ previewGlbFile: undefined });
  try {
    await run.flush(); run.resolve(0); await run.flush();
    const original = run.primitive().props.object;
    run.updateProps({ glbFile: "replacement.glb" }); await run.flush();
    run.requests[1].reject(new Error("offline")); await run.flush();
    assert.equal(run.primitive().props.object, original);
    assert.equal(run.tree.props.userData.deliveryReady, false);
    run.find("button").props.onClick({ stopPropagation() {} }); await run.flush();
    assert.equal(run.requests[2].url, "/models/replacement.glb");
    assert.equal(run.primitive().props.object, original);
    run.resolve(2); await run.flush();
    assert.notEqual(run.primitive().props.object, original);
    assert.equal(run.tree.props.userData.deliveryPending, false);
  } finally { run.unmount(); console.error = originalError; }
});

test("material-only updates stay pending until the new appearance is prepared", async () => {
  const run = harness({ previewGlbFile: undefined });
  try {
    await run.flush(); run.resolve(0); await run.flush();
    const original = run.primitive().props.object;
    run.updateProps({ frontColor: "#223344" }); await run.flush();
    assert.equal(run.primitive().props.object, original);
    assert.equal(run.tree.props.userData.deliveryReady, false);
    run.resolve(1); await run.flush();
    assert.notEqual(run.primitive().props.object, original);
    assert.equal(run.tree.props.userData.deliveryReady, true);
  } finally { run.unmount(); }
});

test("failed finish textures retain the previous material instead of displaying an untextured replacement", async () => {
  const originalError = console.error; console.error = () => {};
  let errors = 0;
  const run = harness({onError: () => errors++});
  try {
    await run.flush(); run.resolve(0); await run.flush();
    const original = run.primitive().props.object;
    run.updateProps({frontMaterial: {baseColor: '#bb905d', roughness: .6, metalness: 0, texturePaths: {baseColor: '/missing-wood.webp'}}});
    await run.flush(); run.resolve(1); await run.flush();
    assert.equal(run.primitive().props.object, original);
    assert.equal(run.tree.props.userData.deliveryReady, false);
    assert.equal(errors, 1);
    assert.equal(run.released.length, 1, 'failed material delivery releases its model lease');
  } finally {run.unmount(); console.error = originalError;}
});

test("a selected finish replaces old surface relief while preserving baked geometry occlusion", async () => {
  const source = new THREE.MeshStandardMaterial({normalMap: new THREE.Texture(), bumpMap: new THREE.Texture(), aoMap: new THREE.Texture()});
  source.normalScale.set(4, -3); source.normalMapType = THREE.ObjectSpaceNormalMap;
  const normal = new THREE.Texture();
  const run = harness({frontMaterial: {baseColor: '#eeeeee', roughness: .4, metalness: 0, texturePaths: {normal: '/paint-normal.webp'}}}, {'/paint-normal.webp': normal});
  try {
    await run.flush(); run.resolve(0, source); await run.flush();
    const material = run.primitive().props.object.children[0].material;
    assert.equal(material.normalMap, normal);
    assert.deepEqual(material.normalScale.toArray(), [1, 1]);
    assert.equal(material.normalMapType, THREE.TangentSpaceNormalMap);
    assert.equal(material.bumpMap, null);
    assert.equal(material.aoMap, source.aoMap);
    assert.deepEqual(source.normalScale.toArray(), [4, -3]);
    assert.ok(source.bumpMap);
  } finally {run.unmount();}
});

test("repeated meshes reuse isolated materials without mixing front and carcass finishes", async () => {
  const source = new THREE.MeshStandardMaterial({color: '#abcdef'});
  const run = harness({
    frontMaterial: {baseColor: '#ffffff', roughness: .3, metalness: 0, texturePaths: {}},
    carcassMaterial: {baseColor: '#765432', roughness: .8, metalness: 0, texturePaths: {}},
  });
  let disposed = 0;
  try {
    await run.flush();
    const scene = run.resolve(0, source);
    const secondDoor = scene.children[0].clone(), carcass = scene.children[0].clone();
    carcass.name = 'cabinet_box'; scene.add(secondDoor, carcass);
    await run.flush();
    const [first, second, box] = run.primitive().props.object.children;
    assert.equal(first.material, second.material);
    assert.notEqual(first.material, source);
    assert.notEqual(first.material, box.material);
    assert.equal(first.material.color.getHexString(), 'ffffff');
    assert.equal(box.material.color.getHexString(), '765432');
    assert.equal(source.color.getHexString(), 'abcdef');
    first.material.addEventListener('dispose', () => disposed++);
  } finally {run.unmount();}
  assert.equal(disposed, 1);
});

test("camera and drag motion retain the identical delivery without extra leases, clones or metrics", async () => {
  const originalWindow = global.window;
  global.window = { location: { origin: "https://shop.example" } };
  const run = harness();
  try {
    await run.flush(); run.resolve(0, undefined, 297424); await run.flush(); run.draw();
    const delivery = run.primitive().props.object;
    for (let i = 0; i < 10; i++) {
      run.motion(true); await run.flush(); run.draw();
      assert.equal(run.primitive().props.object, delivery);
      assert.equal(run.tree.props.userData.deliveryPending, false);
      run.motion(false); await run.flush();
      assert.equal(run.primitive().props.object, delivery);
    }
    assert.equal(run.requests.length, 1);
    assert.deepEqual(run.metrics.map(metric => metric.variant), ["high"]);
    assert.deepEqual(run.released, []);
  } finally { run.unmount(); global.window = originalWindow; }
  assert.deepEqual(run.released, ["/models/high.glb"]);
});

test("failed initial delivery reports an error and retry uses the same delivery; unmount cancels attachment", async () => {
  const originalError = console.error; console.error = () => {};
  let errors = 0;
  const run = harness({ onError: () => errors++ });
  try {
    await run.flush(); run.requests[0].reject(new Error("offline")); await run.flush();
    assert.equal(errors, 1); assert.equal(run.primitive(), null);
    assert.equal(run.tree.props.userData.deliveryPending, true);
    run.find("button").props.onClick({ stopPropagation() {} }); await run.flush();
    assert.deepEqual(run.requests.map(request => request.url), ["/models/high.glb", "/models/high.glb"]);
    run.unmount(); run.resolve(1); await run.flush();
    assert.equal(run.primitive(), null);
    assert.deepEqual(run.released, ["/models/high.glb", "/models/high.glb"]);
  } finally { console.error = originalError; }
});

test("unseen room furniture does not fetch until it enters the camera or is selected", async () => {
  const camera = new THREE.PerspectiveCamera(50,1,.1,100);
  camera.position.set(0,1,5); camera.lookAt(0,.5,0); camera.updateMatrixWorld(true);
  const run = harness({ deferUntilVisible: true });
  run.root.position.x = 100;
  await run.flush(); run.camera(camera); await run.flush();
  assert.equal(run.requests.length, 0);
  run.root.position.x = 0;
  run.camera(camera); await run.flush();
  assert.equal(run.requests[0].url, "/models/high.glb");
  run.unmount(); run.resolve(0); await run.flush();

  const selected = harness({ deferUntilVisible: true, selected: true });
  selected.root.position.x = 100;
  await selected.flush(); assert.equal(selected.requests.length, 1);
  selected.unmount(); selected.resolve(0); await selected.flush();
});

test("offscreen non-deferred cabinets become export-ready without waiting for a preview draw", async () => {
  const run = harness(); run.root.position.x = 100;
  try {
    await run.flush(); run.resolve(0); await run.flush();
    assert.equal(run.requests.length, 1);
    assert.equal(run.tree.props.userData.deliveryPending, false);
  } finally { run.unmount(); }
});

test("selection and legacy preview changes never restart the same delivery", async () => {
  const run = harness({ deferUntilVisible: true, selected: true });
  try {
    await run.flush(); run.resolve(0); await run.flush();
    const delivery = run.primitive().props.object;
    for (const selected of [false, true, false]) {
      run.updateProps({ selected, previewGlbFile: "other-preview.glb" }); await run.flush();
      assert.equal(run.requests.length, 1);
      assert.equal(run.primitive().props.object, delivery);
      assert.equal(run.tree.props.userData.deliveryPending, false);
    }
  } finally { run.unmount(); }
});

 test("room GLBs retain authored colour and surface textures on independent material clones", async () => {
  const originalWindow=global.window;global.window={location:{origin:'https://shop.example'}};
  const source=new THREE.MeshStandardMaterial({color:'#d2cbc0',normalMap:new THREE.Texture(),aoMap:new THREE.Texture(),map:new THREE.Texture()});
  source.envMapIntensity=.8;
  const run=harness({previewGlbFile:undefined,environmentBoost:1.25});
  try {
    await run.flush();run.resolve(0,source);await run.flush();
    const material=run.primitive().props.object.children[0].material;
    assert.notEqual(material,source);assert.equal(material.color.getHex(),source.color.getHex());
    assert.equal(material.map,source.map);assert.equal(material.normalMap,source.normalMap);assert.equal(material.aoMap,source.aoMap);
    assert.equal(material.aoMapIntensity,source.aoMapIntensity,"default room rendering must preserve authored occlusion");
    assert.equal(material.side,THREE.FrontSide,"authored culling must not expose overlapping back faces");
    assert.equal(material.envMapIntensity,1);assert.equal(source.envMapIntensity,.8);
  } finally {run.unmount();global.window=originalWindow;}
});

test("an intentionally double-sided imported material stays double-sided",async()=>{
  const source=new THREE.MeshStandardMaterial({side:THREE.DoubleSide});
  const run=harness();
  try {
    await run.flush();run.resolve(0,source);await run.flush();
    assert.equal(run.primitive().props.object.children[0].material.side,THREE.DoubleSide);
    assert.equal(source.side,THREE.DoubleSide);
  }finally{run.unmount();}
});

test("room-only baked AO is disabled without changing colour maps or the shared source",async()=>{
  const originalWindow=global.window;global.window={location:{origin:'https://shop.example'}};
  const source=new THREE.MeshStandardMaterial({color:'#bbbbbb',map:new THREE.Texture(),aoMap:new THREE.Texture()});source.aoMapIntensity=1;
  const run=harness({previewGlbFile:undefined,bakedOcclusionIntensity:0});
  try{await run.flush();run.resolve(0,source);await run.flush();const material=run.primitive().props.object.children[0].material;
    assert.equal(material.aoMapIntensity,0);assert.equal(source.aoMapIntensity,1);assert.equal(material.aoMap,source.aoMap);assert.equal(material.map,source.map);assert.equal(material.color.getHex(),source.color.getHex());
  }finally{run.unmount();global.window=originalWindow;}
});

test("new local occlusion bakes retain crease depth under room lighting",async()=>{
  const originalWindow=global.window;global.window={location:{origin:'https://shop.example'}};
  const source=new THREE.MeshStandardMaterial({map:new THREE.Texture(),aoMap:new THREE.Texture()});
  source.aoMapIntensity=.85;source.userData.qualityBakeOcclusion=1;
  const run=harness({previewGlbFile:undefined,bakedOcclusionIntensity:0});
  try {
    await run.flush();run.resolve(0,source);await run.flush();
    const material=run.primitive().props.object.children[0].material;
    assert.equal(material.aoMapIntensity,.85);
    assert.equal(material.aoMap,source.aoMap);
    assert.equal(material.map,source.map);
    assert.equal(source.aoMapIntensity,.85);
  }finally{run.unmount();global.window=originalWindow;}
});
