const { test } = require("node:test");
const assert = require("node:assert/strict");
const id = "11111111-2222-4333-8444-555555555555";
const job = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const model = {
  id, processing_job_id: job,
  source_glb_path: `r2://bucket/models/${id}/source/${job}.glb`,
  glb_path: `r2://bucket/models/${id}/delivery/${job}/model-${job}.glb`,
  preview_glb_path: null,
};
const policy = () => import("../scripts/models/delivery-policy.mjs");

test("a verified current delivery authorizes cleanup with no preview, including legacy deliveries", async () => {
  const { cleanupReadyDeliverySource } = await policy();
  for (const glb_path of [model.glb_path, `r2://bucket/models/${id}/lod/${job}/high.glb`]) {
    const calls = [];
    assert.equal(await cleanupReadyDeliverySource({ ...model, glb_path }, "bucket",
      async key => { calls.push(["head", key]); return { ContentLength: 128 }; },
      async (...args) => { calls.push(["cleanup", ...args]); return true; }), true);
    assert.deepEqual(calls, [["head", glb_path.slice("r2://bucket/".length)],
      ["cleanup", id, job, model.source_glb_path]]);
  }
});

test("missing delivery, failed HEAD and stale or foreign references never authorize source deletion", async () => {
  const { cleanupReadyDeliverySource } = await policy();
  const cleanup = () => assert.fail("source must be preserved");
  for (const ContentLength of [undefined, NaN, 0, 11])
    await assert.rejects(cleanupReadyDeliverySource(model, "bucket", async () => ({ ContentLength }), cleanup), /preserving source/);
  await assert.rejects(cleanupReadyDeliverySource(model, "bucket", async () => { throw new Error("offline"); }, cleanup), /offline/);
  for (const patch of [{ processing_job_id: id }, { glb_path: model.source_glb_path },
    { source_glb_path: `r2://bucket/models/${id}/source/${id}.glb` }, { id: job }])
    await assert.rejects(cleanupReadyDeliverySource({ ...model, ...patch }, "bucket", () => assert.fail("must not HEAD foreign keys"), cleanup));
});

test("single delivery publish clears the old preview reference", async () => {
  const { deliveryPublishFields } = await policy();
  assert.deepEqual(deliveryPublishFields(model.glb_path), { glb_path: model.glb_path, preview_glb_path: null });
});

test("sofa cleanup is never selected for other furniture or kitchen assemblies", async () => {
  const { geometryProfileForModel } = await policy();
  assert.equal(geometryProfileForModel({ category: "sofa" }), "sofa-surface");
  for (const category of ["kitchen-cabinet", "bed", "table", undefined])
    assert.equal(geometryProfileForModel({ category }), "preserve");
  for (const assetRole of ["kitchen-part", "kitchen-assembly"])
    assert.equal(geometryProfileForModel({ category: "sofa", glb_validation: { assetRole } }), "preserve");
});

test("unsupported or authored sofa assets preserve geometry instead of running surface extraction", async () => {
  const { sofaSurfaceEligibility } = await policy();
  const source = { nodes: [{ mesh: 0 }], materials: [{}], meshes: [{ primitives: [
    { attributes: { POSITION: 1, TEXCOORD_0: 0 }, material: 0 },
  ] }] };
  assert.equal(sofaSurfaceEligibility(source), null, "accessor zero is valid");
  for (const patch of [
    { animations: [{}] }, { skins: [{}] }, { images: [{ mimeType: "image/ktx2" }] },
    { nodes: [{ name: "socket_right", mesh: 0 }] }, { nodes: [{ mesh: 0, extras: { attachment: 1 } }] },
    { nodes: [{ mesh: 0, extensions: { EXT_mesh_gpu_instancing: {} } }] },
    { materials: [{ alphaMode: "BLEND" }] }, { materials: [{ extensions: { KHR_materials_transmission: {} } }] },
    ...[{ targets: [{}] }, { mode: 1 }, { attributes: { POSITION: 0 } },
      { attributes: { TEXCOORD_0: 1, TEXCOORD_1: 2 } }].map(primitive => ({ meshes: [{ primitives: [
        { ...source.meshes[0].primitives[0], ...primitive },
      ] }] })),
  ]) assert.ok(sofaSurfaceEligibility({ ...source, ...patch }), JSON.stringify(patch));
});
