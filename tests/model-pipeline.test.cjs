const { test } = require("node:test");
const assert = require("node:assert/strict");
const THREE = require("three");

const { loadSource } = require("./helpers/load-source.cjs");

const { modelLodFiles, modelAssetPaths, chooseModelLod } = loadSource(
  "src/lib/modelAssets.ts",
);

const { instanceRepeatedModules } = loadSource("src/three/instanceModules.ts");

const { modelDeliveryUrl } = loadSource("src/lib/modelPrefetch.ts");

const { selectCanvasPerformance } = loadSource(
  "src/three/canvasPerformance.ts",
);

const { r2ModelKey } = loadSource("src/lib/r2Models.ts", {
  "@/lib/supabase/admin": { getSupabaseAdmin: () => ({}) },
  "@/lib/cloudinaryModels": { removeModelFiles: async () => {} },
});

const id = "11111111-2222-4333-8444-555555555555";

test("delivery URL safely encodes model identifiers and filenames", () => {
  assert.equal(
    modelDeliveryUrl("model id", "delivery model.glb"),
    "/api/models/files/model%20id/delivery%20model.glb",
  );
});

test("3D canvas quality protects mobile and constrained devices", () => {
  assert.deepEqual(
    selectCanvasPerformance({ narrow: false, reducedMotion: false }),
    {
      dpr: [1, 1.5],
      shadows: true,
      contactShadows: true,
      autoRotate: true,
    },
  );

  assert.deepEqual(
    selectCanvasPerformance({
      narrow: true,
      reducedMotion: false,
      hardwareConcurrency: 4,
      deviceMemory: 4,
    }),
    {
      dpr: 1,
      shadows: false,
      contactShadows: false,
      autoRotate: false,
    },
  );

  assert.equal(
    selectCanvasPerformance({
      narrow: false,
      reducedMotion: false,
      saveData: true,
    }).shadows,
    false,
  );
});

test("delivery model assets expose preview first and preserve the high model", () => {
  const high = "model-11111111-2222-4333-8444-555555555555.glb";
  const preview = "preview-11111111-2222-4333-8444-555555555555.glb";

  assert.deepEqual(modelLodFiles(high, preview), {
    high,
    preview,
  });

  assert.equal(modelLodFiles("high.obj"), null);
  assert.equal(modelLodFiles(high, "preview.obj"), null);

  const highPath = `r2://bucket/models/${id}/delivery/${id}/model-${id}.glb`;
  const previewPath = `r2://bucket/models/${id}/delivery/${id}/preview-${id}.glb`;

  assert.deepEqual(modelAssetPaths(highPath, previewPath), [
    highPath,
    previewPath,
  ]);

  assert.equal(chooseModelLod(), "high");
  assert.equal(chooseModelLod(true), "preview");
});

test("R2 model validation accepts the direct kitchen source GLB", () => {
  const source = `r2://bucket/models/${id}/source/${id}.glb`;

  assert.equal(r2ModelKey(source), `models/${id}/source/${id}.glb`);
  assert.equal(
    r2ModelKey(`r2://bucket/models/${id}/source/not-a-uuid.glb`),
    null,
  );
});

test("R2 model validation accepts only job-addressed delivery GLBs", () => {
  assert.equal(r2ModelKey(`r2://bucket/models/${id}/lod/${id}/low.glb`), `models/${id}/lod/${id}/low.glb`);
  const delivery =
    `r2://bucket/models/${id}/delivery/${id}/model-${id}.glb`;

  assert.equal(
    r2ModelKey(delivery),
    `models/${id}/delivery/${id}/model-${id}.glb`,
  );

  assert.equal(
    r2ModelKey(`r2://bucket/models/${id}/delivery/${id}/preview-${id}.glb`),
    `models/${id}/delivery/${id}/preview-${id}.glb`,
  );

  assert.equal(
    r2ModelKey(
      `r2://bucket/models/${id}/delivery/${id}/model-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.glb`,
    ),
    null,
  );
});

test("preview backfill accepts legacy/high deliveries but rejects sources and cross-model references", async () => {
  const { previewReference } = await import("../scripts/models/preview-reference.mjs");
  const buildId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const model = { id, processing_job_id: id };
  for (const tail of [`delivery/${id}/model-${id}.glb`, `lod/${id}/high.glb`]) {
    const result = previewReference({ ...model, glb_path: `r2://bucket/models/${id}/${tail}` }, "bucket", buildId);
    assert.equal(result.highKey, `models/${id}/${tail}`);
    assert.equal(result.previewKey, `models/${id}/delivery/${buildId}/preview-${buildId}.glb`);
  }
  for (const glb_path of [`r2://bucket/models/${id}/source/${id}.glb`, `r2://bucket/models/${buildId}/lod/${id}/high.glb`, `r2://other/models/${id}/lod/${id}/high.glb`]) {
    assert.throws(() => previewReference({ ...model, glb_path }, "bucket", buildId));
  }
});

test("model performance endpoint accepts bounded same-origin timings", async () => {
  const { POST } = loadSource("src/app/api/model-metrics/route.ts");
  const originalInfo = console.info;
  const logged = [];
  console.info = (...args) => logged.push(args);
  try {
    const response = await POST({
      headers: new Headers({
        origin: "https://shop.example",
        "content-length": "180",
      }),
      nextUrl: { origin: "https://shop.example" },
      body: new Response(JSON.stringify({
        asset: `/api/models/files/${id}/preview-${id}.glb`,
        variant: "preview",
        readyMs: 420,
        queueMs: 4,
        loadDecodeMs: 390,
        resourceDurationMs: 260,
        encodedBodySize: 1_500_000,
        untrustedExtra: "must not appear in logs",
      })).body,
    });
    assert.equal(response.status, 204);
    assert.equal(logged.length, 1);
    assert.equal(logged[0][1].includes("untrustedExtra"), false);

    const rejected = await POST({
      headers: new Headers({ origin: "https://attacker.example" }),
      nextUrl: { origin: "https://shop.example" },
      body: new Response("{}").body,
    });
    assert.equal(rejected.status, 400);
    const oversized = await POST({
      headers: new Headers(),
      nextUrl: { origin: "https://shop.example" },
      body: new Response(" ".repeat(4097)).body,
    });
    assert.equal(oversized.status, 400);
  } finally {
    console.info = originalInfo;
  }
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
    setMeshoptDecoder(decoder) {
      assert.ok(decoder);

      return this;
    }

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

      "three/examples/jsm/libs/meshopt_decoder.module.js": {
        MeshoptDecoder: { ready: Promise.resolve() },
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
