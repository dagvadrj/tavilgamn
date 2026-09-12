const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { modelLodFiles, modelAssetPaths, chooseModelLod } = loadSource('src/lib/modelAssets.ts');
const { instanceRepeatedModules } = loadSource('src/three/instanceModules.ts');
const id = '11111111-2222-4333-8444-555555555555';

test('versioned LOD names preserve old GLBs and reject path injection', () => {
  const high = `model-${id}-0.glb`;
  assert.deepEqual(modelLodFiles(high), { high, medium: `model-${id}-1.glb`, low: `model-${id}-2.glb` });
  assert.equal(modelLodFiles(`../${high}`), null);
  assert.equal(modelLodFiles('model.glb'), null);
  assert.equal(modelLodFiles(`model-${id}.glb`), null);
  assert.equal(modelAssetPaths(`r2://bucket/models/${id}/${high}`).length, 3);
  assert.deepEqual(modelAssetPaths('legacy/model.glb'), ['legacy/model.glb']);
  assert.match(`r2://bucket/models/${id}/${high}`, new RegExp(`^r2://[a-z0-9-]+/models/${id}/model-[0-9a-f-]+[.]glb$`), 'compatible with existing SQL replacement guard');
});

test('LOD hysteresis does not chatter at distance boundaries', () => {
  assert.equal(chooseModelLod(2, 'low'), 'high');
  assert.equal(chooseModelLod(4.4, 'high'), 'high');
  assert.equal(chooseModelLod(4.7, 'high'), 'medium');
  assert.equal(chooseModelLod(10, 'medium'), 'medium');
  assert.equal(chooseModelLod(12, 'medium'), 'low');
  assert.equal(chooseModelLod(9, 'low'), 'low');
  assert.equal(chooseModelLod(8, 'low'), 'medium');
});

test('instancing matches exact geometry/material and preserves nested world-space bounds', () => {
  const root = new THREE.Group(); root.position.set(2, 1, -3); root.rotation.y = .4;
  const parent = new THREE.Group(); parent.position.set(.4, 0, 1); root.add(parent);
  const material = new THREE.MeshStandardMaterial();
  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, .1, .4), material);
    mesh.position.set(0, i * .4, 0); parent.add(mesh);
  }
  root.updateMatrixWorld(true);
  const before = new THREE.Box3().setFromObject(root);
  assert.equal(instanceRepeatedModules(root), 5);
  root.updateMatrixWorld(true);
  const after = new THREE.Box3().setFromObject(root);
  assert.ok(before.min.distanceTo(after.min) < 1e-6);
  assert.ok(before.max.distanceTo(after.max) < 1e-6);
  assert.equal(root.children.find(o => o.isInstancedMesh).count, 6);
});

test('transparent, mirrored, animated and distinct modules are not silently instanced', () => {
  for (const variant of ['transparent', 'mirrored', 'animated', 'different']) {
    const root = new THREE.Group(), material = new THREE.MeshStandardMaterial({ transparent: variant === 'transparent' });
    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(variant === 'different' ? i + 1 : 1, 1, 1), material);
      if (variant === 'mirrored') mesh.scale.x = -1;
      if (variant === 'animated') mesh.animations.push(new THREE.AnimationClip('open', 1, []));
      root.add(mesh);
    }
    assert.equal(instanceRepeatedModules(root), 0, variant);
  }
});

test('loader shares requests, limits concurrency, retries failures and retains active resources', async () => {
  const originalTimeout = global.setTimeout, originalClear = global.clearTimeout;
  let timers = [], loads = 0, running = 0, peak = 0, disposals = 0, fail = false;
  global.setTimeout = fn => { timers.push(fn); return timers.length; };
  global.clearTimeout = id => { timers[id - 1] = null; };
  const gates = [];
  class Decoder { setDecoderPath() { return this; } setWorkerLimit() { return this; } setTranscoderPath() { return this; } detectSupport() { return this; } dispose() {} }
  class Loader {
    setDRACOLoader() { return this; } setKTX2Loader() { return this; }
    async loadAsync() {
      loads++; running++; peak = Math.max(peak, running);
      await new Promise(resolve => gates.push(resolve)); running--;
      if (fail) { fail = false; throw new Error('network'); }
      const scene = new THREE.Group(), geometry = new THREE.BoxGeometry(); geometry.addEventListener('dispose', () => disposals++);
      scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial())); return { scene, animations: [] };
    }
  }
  try {
    const { acquireModel } = loadSource('src/three/modelLoader.ts', {
      'three/examples/jsm/loaders/GLTFLoader.js': { GLTFLoader: Loader },
      'three/examples/jsm/loaders/DRACOLoader.js': { DRACOLoader: Decoder },
      'three/examples/jsm/loaders/KTX2Loader.js': { KTX2Loader: Decoder },
      'three/examples/jsm/utils/SkeletonUtils.js': { clone: scene => scene.clone(true) },
    });
    const renderer = {};
    const a = acquireModel(renderer, 'a'), same = acquireModel(renderer, 'a');
    assert.equal(a.promise, same.promise); gates.shift()(); await a.promise;
    a.release(); assert.equal(disposals, 0); assert.equal(loads, 1);
    const many = Array.from({ length: 6 }, (_, i) => acquireModel(renderer, `asset-${i}`));
    while (loads < 7 || running) { while (gates.length) gates.shift()(); await new Promise(resolve => setImmediate(resolve)); }
    await Promise.all(many.map(item => item.promise)); assert.equal(peak, 3);
    many.forEach(item => item.release()); assert.ok(disposals > 0);
    const stillShared = acquireModel(renderer, 'a'); assert.equal(stillShared.promise, same.promise);
    stillShared.release(); same.release();
    fail = true; const bad = acquireModel(renderer, 'retry'); gates.shift()(); await assert.rejects(bad.promise); bad.release();
    const good = acquireModel(renderer, 'retry'); gates.shift()(); await good.promise; good.release();
    timers.filter(Boolean).forEach(fn => fn());
  } finally { global.setTimeout = originalTimeout; global.clearTimeout = originalClear; }
});

function glb(triangles, source = 'a'.repeat(64)) {
  const json = { asset: { version: '2.0' }, accessors: [{ count: triangles * 3 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], nodes: [{ mesh: 0 }],
    scene: 0, scenes: [{ extras: { pipelineBounds: { min: [0, 0, 0], max: [1, 1, 1] }, pipelineAssetId: source } }] };
  const bytes = Buffer.from(JSON.stringify(json)), length = Math.ceil(bytes.length / 4) * 4;
  const result = Buffer.alloc(20 + length, 32);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(length, 12); result.writeUInt32LE(0x4e4f534a, 16); bytes.copy(result, 20);
  return new File([result], 'model.glb');
}

test('bundle validates before writes, enforces common source and cleans partial uploads', async () => {
  const uploaded = [], cleaned = [];
  let failAt = 0;
  const { readModelBundle, uploadModelBundle } = loadSource('src/lib/modelUploadBundle.ts', {
    './supabase/admin': {}, './r2Models': {
      uploadR2Glb: async (_, modelId, name) => { if (uploaded.length === failAt) throw new Error('upload failed'); const path = `r2://bucket/models/${modelId}/${name}`; uploaded.push(path); return path; },
      removeStoredModelFiles: async (_, paths) => cleaned.push(...paths),
    },
  });
  assert.deepEqual(await readModelBundle(new FormData(), glb(300000)).then(v => Object.keys(v)), ['high'], 'old single-file upload stays compatible');
  const form = new FormData(); form.set('glbMedium', glb(15000));
  await assert.rejects(readModelBundle(form, glb(30000)));
  form.set('glbLow', glb(5000));
  await assert.rejects(readModelBundle(form, glb(30001)));
  form.set('glbLow', glb(5000, 'b'.repeat(64))); await assert.rejects(readModelBundle(form, glb(30000)));
  form.set('glbLow', glb(5000));
  const bundle = await readModelBundle(form, glb(30000));
  failAt = 1; await assert.rejects(uploadModelBundle(bundle, id, {})); assert.equal(cleaned.length, 1);
  uploaded.length = 0; failAt = -1;
  const high = await uploadModelBundle(bundle, id, {});
  assert.equal(uploaded.length, 3); assert.ok(uploaded[0].endsWith('-2.glb')); assert.ok(high.endsWith('-0.glb'));
});

test('offline GLB inspector counts placed instances and flags atlas restrictions', async () => {
  const { triangleCount, atlasAudit } = await import('../scripts/models/optimize-glb.mjs');
  assert.equal(triangleCount({ meshes: [{ primitives: [{ indices: 0, attributes: {} }] }], accessors: [{ count: 300 }], nodes: [{ mesh: 0 }, { mesh: 0 }] }), 200);
  const audit = atlasAudit({ materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } }, normalTexture: { index: 1 } }], textures: [{}, {}] });
  assert.equal(audit[0].automaticAtlasApplied, false); assert.equal(audit[0].candidate, false);
  assert.ok(audit[0].reasons.some(reason => reason.includes('Repeating UV')));
});
