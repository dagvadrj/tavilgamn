const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Only this current job's verified delivery can authorize source cleanup.
// Legacy high.glb paths are accepted without depending on a historical preview.
export function deliveryReference(model, bucket) {
  if (![model.id, model.processing_job_id].every(value => typeof value === "string" && UUID.test(value)))
    throw new Error("Invalid model/job reference");
  const prefix = `r2://${bucket}/models/${model.id}/`;
  const job = model.processing_job_id;
  if (![`${prefix}delivery/${job}/model-${job}.glb`, `${prefix}lod/${job}/high.glb`].includes(model.glb_path))
    throw new Error("Delivery does not belong to the current model/job; preserving source");
  if (model.source_glb_path !== `${prefix}source/${job}.glb`)
    throw new Error("Source does not belong to the current model/job");
  return model.glb_path.slice(`r2://${bucket}/`.length);
}

export async function cleanupReadyDeliverySource(model, bucket, head, cleanup) {
  const key = deliveryReference(model, bucket);
  const object = await head(key);
  if (!Number.isFinite(object.ContentLength) || object.ContentLength < 12)
    throw new Error("Delivery is missing or empty; preserving source");
  return cleanup(model.id, model.processing_job_id, model.source_glb_path);
}

export function deliveryPublishFields(deliveryPath) {
  return { glb_path: deliveryPath, preview_glb_path: null };
}

export function geometryProfileForModel(model) {
  return model.category === "sofa" && !["kitchen-part", "kitchen-assembly"].includes(model.glb_validation?.assetRole)
    ? "sofa-surface" : "preserve";
}

// Conservative eligibility: other assets use geometry-preserving compression.
// This is not a general-purpose furniture remesher or an assembly optimizer.
export function sofaSurfaceEligibility(json) {
  if (json.animations?.length || json.skins?.length) return "animated or skinned";
  if (json.images?.some(image => image.mimeType === "image/ktx2")) return "already GPU compressed";
  if (!json.meshes?.length || json.nodes?.some(node => node.extensions || node.extras || /socket|anchor|connector/i.test(node.name ?? ""))) return "authored node metadata";
  for (const mesh of json.meshes) for (const primitive of mesh.primitives ?? []) {
    if (primitive.targets?.length || (primitive.mode ?? 4) !== 4) return "non-static triangle mesh";
    if (primitive.attributes?.TEXCOORD_0 === undefined ||
        Object.keys(primitive.attributes).filter(key => key.startsWith("TEXCOORD_")).length !== 1 ||
        primitive.material === undefined)
      return "requires exactly one UV set and explicit materials";
  }
  for (const material of json.materials ?? []) {
    if ((material.alphaMode ?? "OPAQUE") !== "OPAQUE" || Object.keys(material.extensions ?? {}).length)
      return "transparent or extended materials";
  }
  return null;
}
