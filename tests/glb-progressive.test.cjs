const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const THREE = require("three");
const { loadSource } = require("./helpers/load-source.cjs");

// Run the real component's hooks and draw callbacks without needing a GPU.
function harness(patch = {}) {
  const slots = [], requests = [], metrics = [], released = [];
  let cursor = 0, dirty = true, effects = [], frame, tree;
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
    useEffect(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
      }
    },
  };
  const { GLBFurnitureMesh } = loadSource("src/three/GLBFurnitureMesh.tsx", {
    react: mockedReact,
    "@react-three/fiber": { useThree: () => ({ gl: renderer }), useFrame: fn => { frame = fn; } },
    "@react-three/drei": { Edges: () => null, Html: () => null },
    "./kitchenMaterialTextures": { acquireKitchenMaterialTextures: () => ({ promise: Promise.resolve({}), release() {} }) },
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
    dirty = false; cursor = 0; effects = [];
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
  function resolve(index, material = new THREE.MeshStandardMaterial()) {
    const scene = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), material);
    mesh.name = "front"; scene.add(mesh);
    requests[index].resolve({ scene,
      bounds: new THREE.Box3(new THREE.Vector3(-.5,0,-.5), new THREE.Vector3(.5,1,.5)),
      metrics: { queueMs: 0, loadDecodeMs: 10, resourceDurationMs: 8, encodedBodySize: 100 } });
  }
  return { props, requests, metrics, released, root, flush, resolve,
    updateProps(patch) { Object.assign(props, patch); dirty = true; },
    motion(value) { motion = value; dirty = true; },
    get tree() { return tree; },
    primitive: () => find(tree, "primitive"),
    draw() {
      const primitive = find(tree, "primitive");
      assert.ok(primitive, "a loaded model must be on screen");
      primitive.props.object.traverse(object => { if (object instanceof THREE.Mesh) object.onAfterRender(); });
    },
    camera(camera) { frame({ camera }); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

test("preview draws before high starts, high swaps at identical size/origin and readiness is reported once", async () => {
  const originalWindow = global.window;
  global.window = { location: { origin: "https://shop.example" } };
  let ready = 0;
  const run = harness({ onReady: () => ready++ });
  try {
    await run.flush();
    assert.deepEqual(run.requests.map(request => request.url), ["/models/preview.glb"]);
    run.resolve(0); await run.flush();
    assert.equal(ready, 0);
    assert.equal(run.requests.length, 1, "high waits for the first preview draw");
    const previewPosition = run.primitive().props.position;
    run.draw(); await run.flush();
    assert.equal(ready, 1);
    assert.equal(run.requests[1].url, "/models/high.glb");
    run.resolve(1); await run.flush(); run.draw();
    assert.deepEqual(run.primitive().props.position, previewPosition);
    assert.equal(run.tree.props.children[0].props.scale[0], 2);
    assert.equal(run.tree.props.userData.deliveryPending, false);
    assert.deepEqual(run.metrics.map(metric => metric.variant), ["preview", "high"]);
    assert.equal(ready, 1);
    assert.deepEqual(run.released, ["/models/preview.glb"]);
  } finally { run.unmount(); global.window = originalWindow; }
  assert.deepEqual(run.released, ["/models/preview.glb", "/models/high.glb"]);
});

test("camera motion reuses retained preview and high without new leases, clones or metrics", async () => {
  const originalWindow = global.window;
  global.window = { location: { origin: "https://shop.example" } };
  const run = harness(); run.motion(false);
  try {
    await run.flush(); run.resolve(0); await run.flush();
    const preview = run.primitive().props.object;
    run.draw(); await run.flush(); run.resolve(1); await run.flush(); run.draw();
    const high = run.primitive().props.object;
    assert.notEqual(high, preview);
    assert.deepEqual(run.released, [], "both leases stay pinned while the viewer is mounted");
    for (let i = 0; i < 10; i++) {
      run.motion(true); await run.flush(); run.draw();
      assert.equal(run.primitive().props.object, preview);
      assert.equal(run.tree.props.userData.deliveryPending, true, "never export a motion preview");
      run.motion(false); await run.flush(); run.draw();
      assert.equal(run.primitive().props.object, high);
      assert.equal(run.tree.props.userData.deliveryPending, false);
    }
    assert.equal(run.requests.length, 2);
    assert.deepEqual(run.metrics.map(metric => metric.variant), ["preview", "high"]);
  } finally { run.unmount(); global.window = originalWindow; }
  assert.deepEqual(run.released.sort(), ["/models/high.glb", "/models/preview.glb"]);
});

test("models without a preview stay on high during camera motion", async () => {
  const run = harness({ previewGlbFile: undefined }); run.motion(false);
  await run.flush(); run.resolve(0); await run.flush();
  const high = run.primitive().props.object;
  run.motion(true); await run.flush();
  assert.equal(run.primitive().props.object, high);
  assert.equal(run.tree.props.userData.deliveryPending, false);
  assert.equal(run.requests.length, 1);
  run.unmount();
});

test("hidden retained variants are excluded from pointer raycasting", async () => {
  const originalWindow = global.window;
  global.window = { location: { origin: "https://shop.example" } };
  const run = harness(); run.motion(false);
  try {
    await run.flush(); run.resolve(0); await run.flush(); run.draw();
    await run.flush(); run.resolve(1); await run.flush();
    for (const moving of [true, false]) {
      run.motion(moving); await run.flush();
      const variants = run.tree.props.children.slice(0, 2);
      const root = new THREE.Group();
      let hits = 0;
      variants.forEach(element => {
        const branch = new THREE.Group();
        branch.visible = element.props.visible;
        branch.raycast = element.props.raycast;
        const mesh = new THREE.Mesh(); mesh.raycast = () => { hits++; };
        branch.add(mesh); root.add(branch);
      });
      new THREE.Raycaster().intersectObject(root, true);
      assert.equal(hits, 1, "pointer events must visit only the active variant");
    }
  } finally { run.unmount(); global.window = originalWindow; }
});

test("retained motion geometry cannot leak into a kitchen export", async () => {
  const { snapshotKitchen } = loadSource("src/three/kitchenExport.ts");
  const originalWindow = global.window;
  global.window = { location: { origin: "https://shop.example" } };
  const run = harness(); run.motion(false);
  const mountTree = element => {
    if (!React.isValidElement(element)) return null;
    const object = element.type === "primitive" ? element.props.object :
      element.type === "group" ? new THREE.Group() : null;
    if (!object) return null;
    if (element.props.visible !== undefined) object.visible = element.props.visible;
    if (element.props.userData) object.userData = element.props.userData;
    for (const child of React.Children.toArray(element.props.children)) {
      const next = mountTree(child); if (next) object.add(next);
    }
    return object;
  };
  try {
    await run.flush(); run.resolve(0); await run.flush();
    run.primitive().props.object.name = "Preview";
    run.draw(); await run.flush(); run.resolve(1); await run.flush();
    run.primitive().props.object.name = "Delivery";
    run.motion(true); await run.flush();
    const movingRoot = mountTree(run.tree); movingRoot.userData.kitchenExport = true;
    assert.throws(() => snapshotKitchen(movingRoot), /Бүрэн чанартай/);
    run.motion(false); await run.flush();
    const idleRoot = mountTree(run.tree); idleRoot.userData.kitchenExport = true;
    const snapshot = snapshotKitchen(idleRoot);
    assert.ok(snapshot.scene.getObjectByName("Delivery"));
    assert.equal(snapshot.scene.getObjectByName("Preview"), undefined);
    snapshot.dispose();
  } finally { run.unmount(); global.window = originalWindow; }
});

test("a failed preview falls back to high; unmount prevents pending requests from starting another stage", async () => {
  const originalError = console.error; console.error = () => {};
  try {
    const failed = harness(); await failed.flush();
    failed.requests[0].reject(new Error("preview unavailable")); await failed.flush();
    assert.equal(failed.requests[1].url, "/models/high.glb");
    failed.unmount(); failed.resolve(1); await failed.flush();
    assert.equal(failed.primitive(), null);
    assert.deepEqual(failed.released, ["/models/preview.glb", "/models/high.glb"]);

    const cancelled = harness(); await cancelled.flush(); cancelled.unmount();
    cancelled.resolve(0); await cancelled.flush();
    assert.equal(cancelled.requests.length, 1);
    assert.deepEqual(cancelled.released, ["/models/preview.glb"]);
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
  assert.equal(run.requests[0].url, "/models/preview.glb");
  run.unmount(); run.resolve(0); await run.flush();

  const selected = harness({ deferUntilVisible: true, selected: true });
  selected.root.position.x = 100;
  await selected.flush(); assert.equal(selected.requests.length, 1);
  selected.unmount(); selected.resolve(0); await selected.flush();
});

test("a high download failure retains the rendered preview without reporting a total model failure", async () => {
  const originalWindow = global.window, originalError = console.error;
  global.window = { location: { origin: "https://shop.example" } };
  console.error = () => {};
  let errors = 0;
  const run = harness({ onError: () => errors++ });
  try {
    await run.flush(); run.resolve(0); await run.flush(); run.draw(); await run.flush();
    const preview = run.primitive().props.object;
    run.requests[1].reject(new Error("high unavailable")); await run.flush();
    assert.equal(run.primitive().props.object, preview);
    assert.equal(errors, 0);
    assert.equal(run.tree.props.userData.deliveryPending, true);
    assert.deepEqual(run.released, ["/models/high.glb"]);
  } finally { run.unmount(); global.window = originalWindow; console.error = originalError; }
});

test("non-deferred cabinets outside the camera still upgrade to high for whole-assembly export", async () => {
  const camera = new THREE.PerspectiveCamera(50,1,.1,100);
  camera.position.set(0,1,5); camera.lookAt(0,.5,0); camera.updateMatrixWorld(true);
  const run = harness(); run.root.position.x = 100;
  await run.flush(); run.resolve(0); await run.flush();
  run.camera(camera); await run.flush();
  assert.equal(run.requests[1].url, "/models/high.glb");
  run.resolve(1); await run.flush();
  assert.equal(run.tree.props.userData.deliveryPending, false);
  run.unmount();
});

test("deselecting a room piece does not restart its progressive loading", async () => {
  const originalWindow = global.window;
  global.window = { location: { origin: "https://shop.example" } };
  const run = harness({ deferUntilVisible: true, selected: true });
  try {
    await run.flush(); run.resolve(0); await run.flush(); run.draw(); await run.flush();
    run.updateProps({ selected: false });
    await run.flush();
    assert.equal(run.requests.length, 2);
    run.resolve(1); await run.flush(); run.draw();
    run.updateProps({ selected: true }); await run.flush();
    run.updateProps({ selected: false }); await run.flush();
    assert.equal(run.requests.length, 2, "selection changes must not reacquire the same assets");
    assert.equal(run.tree.props.userData.deliveryPending, false);
  } finally { run.unmount(); global.window = originalWindow; }
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
    assert.equal(material.envMapIntensity,1);assert.equal(source.envMapIntensity,.8);
  } finally {run.unmount();global.window=originalWindow;}
});

test("room-only baked AO is disabled without changing colour maps or the shared source",async()=>{
  const originalWindow=global.window;global.window={location:{origin:'https://shop.example'}};
  const source=new THREE.MeshStandardMaterial({color:'#bbbbbb',map:new THREE.Texture(),aoMap:new THREE.Texture()});source.aoMapIntensity=1;
  const run=harness({previewGlbFile:undefined,bakedOcclusionIntensity:0});
  try{await run.flush();run.resolve(0,source);await run.flush();const material=run.primitive().props.object.children[0].material;
    assert.equal(material.aoMapIntensity,0);assert.equal(source.aoMapIntensity,1);assert.equal(material.aoMap,source.aoMap);assert.equal(material.map,source.map);assert.equal(material.color.getHex(),source.color.getHex());
  }finally{run.unmount();global.window=originalWindow;}
});
