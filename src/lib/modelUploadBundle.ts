import "server-only";
import { randomUUID } from "node:crypto";
import { modelLodFiles } from "./modelAssets";
import { getSupabaseAdmin } from "./supabase/admin";
import { uploadR2Glb, removeStoredModelFiles } from "./r2Models";

export class ModelBundleError extends Error {}
export type ModelUploadBundle = { high: File; medium?: File; low?: File };
async function inspect(file: File) {
  if (!file.name.toLowerCase().endsWith(".glb") || file.size < 20 || file.size > 50 * 1024 * 1024) throw new ModelBundleError("LOD бүр 50 MB-аас ихгүй GLB байна.");
  const header = new DataView(await file.slice(0, 20).arrayBuffer());
  const length = header.getUint32(12, true);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== file.size || header.getUint32(16, true) !== 0x4e4f534a || length > 5 * 1024 * 1024 || length + 20 > file.size) throw new ModelBundleError("LOD файлын GLB бүтэц буруу байна.");
  try {
    const json = JSON.parse(await file.slice(20, 20 + length).text());
    const counts = (json.meshes ?? []).map((mesh: { primitives: { indices?: number; attributes: { POSITION: number }; mode?: number }[] }) => mesh.primitives.reduce((sum, p) => {
      if ((p.mode ?? 4) !== 4) throw new Error("Triangle geometry required");
      return sum + json.accessors[p.indices ?? p.attributes.POSITION].count / 3;
    }, 0));
    const triangles = (json.nodes ?? []).reduce((sum: number, node: { mesh?: number; extensions?: object }) => {
      if (node.extensions && "EXT_mesh_gpu_instancing" in node.extensions) throw new Error("Upload non-instanced source; runtime instances it");
      return sum + (node.mesh === undefined ? 0 : counts[node.mesh]);
    }, 0);
    const bounds = json.scenes?.[json.scene ?? 0]?.extras?.pipelineBounds;
    const assetId = json.scenes?.[json.scene ?? 0]?.extras?.pipelineAssetId;
    if (!Number.isFinite(triangles) || triangles <= 0 || !bounds || ![bounds.min, bounds.max].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))) throw new Error("Missing geometry metadata");
    if (!Number.isInteger(triangles) || !bounds.min.every((value: number, i: number) => value < bounds.max[i])) throw new Error("Invalid geometry bounds/count");
    if (typeof assetId !== "string" || !/^[a-f0-9]{64}$/.test(assetId)) throw new Error("Missing source identity");
    return { triangles, bounds: JSON.stringify(bounds), assetId };
  } catch { throw new ModelBundleError("LOD файлд pipeline-ийн геометр, хүрээний мэдээлэл шаардлагатай."); }
}

export async function readModelBundle(form: FormData, high: File): Promise<ModelUploadBundle> {
  const medium = form.get("glbMedium"), low = form.get("glbLow");
  if (!medium && !low) return { high };
  if (!(medium instanceof File) || !(low instanceof File) || !medium.size || !low.size) throw new ModelBundleError("LOD ашиглах бол medium болон low файлыг хоёуланг сонгоно уу.");
  const info = await Promise.all([high, medium, low].map(inspect));
  if (info[0].triangles > 30000 || info[1].triangles > info[0].triangles || info[2].triangles > info[1].triangles || info.some(item => item.bounds !== info[0].bounds || item.assetId !== info[0].assetId)) throw new ModelBundleError("High ≤ 30,000 triangle, high ≥ medium ≥ low, нэг эх моделийн LOD файлууд сонгоно уу.");
  return { high, medium, low };
}

export async function uploadModelBundle(bundle: ModelUploadBundle, id: string, db: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  const version = randomUUID();
  const highName = bundle.medium ? `model-${version}-0.glb` : `model-${version}.glb`;
  const files = modelLodFiles(highName);
  const uploaded: string[] = [];
  try {
    if (files && bundle.medium && bundle.low) {
      uploaded.push(await uploadR2Glb(bundle.low, id, files.low));
      uploaded.push(await uploadR2Glb(bundle.medium, id, files.medium));
    }
    const high = await uploadR2Glb(bundle.high, id, highName);
    uploaded.push(high);
    return high;
  } catch (error) {
    if (uploaded.length) await removeStoredModelFiles(db, uploaded).catch(() => console.error("LOD partial upload cleanup failed"));
    throw error;
  }
}
