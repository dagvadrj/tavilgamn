const { test } = require("node:test");
const assert = require("node:assert/strict");
const THREE = require("three");

const { loadSource } = require("./helpers/load-source.cjs");

const { modelLodFiles, modelAssetPaths, chooseModelLod } = loadSource(
  "src/lib/modelAssets.ts",
);

const { instanceRepeatedModules } = loadSource("src/three/instanceModules.ts");

const { r2ModelKey } = loadSource("src/lib/r2Models.ts", {
  "@/lib/supabase/admin": { getSupabaseAdmin: () => ({}) },
  "@/lib/cloudinaryModels": { removeModelFiles: async () => {} },
});

const id = "11111111-2222-4333-8444-555555555555";

test("high-only model assets stay single-file", () => {
  const high = "high.glb";

  assert.deepEqual(modelLodFiles(high), {
    high,
  });

  assert.equal(modelLodFiles("high.obj"), null);

  const path = `r2://bucket/models/${id}/lod/${id}/high.glb`;

  assert.deepEqual(modelAssetPaths(path), [path]);

  assert.equal(chooseModelLod(), "high");
});

test("R2 model validation accepts the direct kitchen source GLB", () => {
  const source = `r2://bucket/models/${id}/source/${id}.glb`;

  assert.equal(r2ModelKey(source), `models/${id}/source/${id}.glb`);
  assert.equal(
    r2ModelKey(`r2://bucket/models/${id}/source/not-a-uuid.glb`),
    null,
  );
});

test("instancing matches exact geometry/material and preserves nested world-space bounds", () => {
  const root = new THREE.Group();

  root.position.set(2, 1, -3);

  root.rotation.y = 0.4;

  const parent = new THREE.Group();

  parent.position.set(0.4, 0, 1);

  root.add(parent);

  const material = new THREE.MeshStandardMaterial();

  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.1, 0.4), material);

    mesh.position.set(0, i * 0.4, 0);

    parent.add(mesh);
  }

  root.updateMatrixWorld(true);

  const before = new THREE.Box3().setFromObject(root);

  assert.equal(instanceRepeatedModules(root), 5);

  root.updateMatrixWorld(true);

  const after = new THREE.Box3().setFromObject(root);

  assert.ok(before.min.distanceTo(after.min) < 1e-6);

  assert.ok(before.max.distanceTo(after.max) < 1e-6);

  assert.equal(root.children.find((object) => object.isInstancedMesh).count, 6);
});

test("transparent, mirrored, animated and distinct modules are not silently instanced", () => {
  for (const variant of ["transparent", "mirrored", "animated", "different"]) {
    const root = new THREE.Group();

    const material = new THREE.MeshStandardMaterial({
      transparent: variant === "transparent",
    });

    for (let i = 0; i < 3; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(variant === "different" ? i + 1 : 1, 1, 1),
        material,
      );

      if (variant === "mirrored") {
        mesh.scale.x = -1;
      }

      if (variant === "animated") {
        mesh.animations.push(new THREE.AnimationClip("open", 1, []));
      }

      root.add(mesh);
    }

    assert.equal(instanceRepeatedModules(root), 0, variant);
  }
});

test("loader shares requests, limits concurrency, retries failures and retains active resources", async () => {
  const originalTimeout = global.setTimeout;

  const originalClear = global.clearTimeout;

  let timers = [];
  let loads = 0;
  let running = 0;
  let peak = 0;
  let disposals = 0;
  let fail = false;

  global.setTimeout = (fn) => {
    timers.push(fn);

    return timers.length;
  };

  global.clearTimeout = (timerId) => {
    timers[timerId - 1] = null;
  };

  const gates = [];

  class Decoder {
    setDecoderPath() {
      return this;
    }

    setWorkerLimit() {
      return this;
    }

    setTranscoderPath() {
      return this;
    }

    detectSupport() {
      return this;
    }

    dispose() {}
  }

  class Loader {
    setDRACOLoader() {
      return this;
    }

    setKTX2Loader() {
      return this;
    }

    async loadAsync() {
      loads++;
      running++;

      peak = Math.max(peak, running);

      await new Promise((resolve) => gates.push(resolve));

      running--;

      if (fail) {
        fail = false;

        throw new Error("network");
      }

      const scene = new THREE.Group();

      const geometry = new THREE.BoxGeometry();

      geometry.addEventListener("dispose", () => {
        disposals++;
      });

      scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));

      return {
        scene,
        animations: [],
      };
    }
  }

  try {
    const { acquireModel } = loadSource("src/three/modelLoader.ts", {
      "three/examples/jsm/loaders/GLTFLoader.js": {
        GLTFLoader: Loader,
      },

      "three/examples/jsm/loaders/DRACOLoader.js": {
        DRACOLoader: Decoder,
      },

      "three/examples/jsm/loaders/KTX2Loader.js": {
        KTX2Loader: Decoder,
      },

      "three/examples/jsm/utils/SkeletonUtils.js": {
        clone: (scene) => scene.clone(true),
      },
    });

    const renderer = {};

    const a = acquireModel(renderer, "a");

    const same = acquireModel(renderer, "a");

    assert.equal(a.promise, same.promise);

    gates.shift()();

    await a.promise;

    a.release();

    assert.equal(disposals, 0);

    assert.equal(loads, 1);

    const many = Array.from(
      {
        length: 6,
      },
      (_, i) => acquireModel(renderer, `asset-${i}`),
    );

    while (loads < 7 || running) {
      while (gates.length) {
        gates.shift()();
      }

      await new Promise((resolve) => setImmediate(resolve));
    }

    await Promise.all(many.map((item) => item.promise));

    assert.equal(peak, 3);

    many.forEach((item) => item.release());

    assert.ok(disposals > 0);

    const stillShared = acquireModel(renderer, "a");

    assert.equal(stillShared.promise, same.promise);

    stillShared.release();
    same.release();

    fail = true;

    const bad = acquireModel(renderer, "retry");

    gates.shift()();

    await assert.rejects(bad.promise);

    bad.release();

    const good = acquireModel(renderer, "retry");

    gates.shift()();

    await good.promise;

    good.release();

    timers.filter(Boolean).forEach((fn) => fn());
  } finally {
    global.setTimeout = originalTimeout;

    global.clearTimeout = originalClear;
  }
});

test("offline GLB inspector counts placed instances and flags atlas restrictions", async () => {
  const { triangleCount, atlasAudit } =
    await import("../scripts/models/optimize-glb.mjs");

  assert.equal(
    triangleCount({
      meshes: [
        {
          primitives: [
            {
              indices: 0,
              attributes: {},
            },
          ],
        },
      ],

      accessors: [
        {
          count: 300,
        },
      ],

      nodes: [
        {
          mesh: 0,
        },
        {
          mesh: 0,
        },
      ],
    }),
    200,
  );

  const audit = atlasAudit({
    materials: [
      {
        pbrMetallicRoughness: {
          baseColorTexture: {
            index: 0,
          },
        },

        normalTexture: {
          index: 1,
        },
      },
    ],

    textures: [{}, {}],
  });

  assert.equal(audit[0].automaticAtlasApplied, false);

  assert.equal(audit[0].candidate, false);

  assert.ok(audit[0].reasons.some((reason) => reason.includes("Repeating UV")));
});
