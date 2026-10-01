const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function previewReference(model, bucket, buildId) {
  if (![model.id, model.processing_job_id, buildId].every(value => typeof value === "string" && UUID.test(value))) {
    throw new Error("Invalid model/job/build reference");
  }
  const prefix = `r2://${bucket}/models/${model.id}/`;
  const job = model.processing_job_id;
  const candidates = [
    `${prefix}delivery/${job}/model-${job}.glb`,
    `${prefix}lod/${job}/high.glb`,
  ];
  if (!candidates.includes(model.glb_path)) {
    throw new Error(`Unsupported high delivery reference for ${model.id}`);
  }
  return {
    highKey: model.glb_path.slice(`r2://${bucket}/`.length),
    // Each attempt gets its own immutable object, including concurrent runs.
    previewKey: `models/${model.id}/delivery/${buildId}/preview-${buildId}.glb`,
  };
}
