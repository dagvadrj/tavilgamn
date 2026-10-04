import { Box3, Matrix4, Quaternion, Vector3 } from "three";

export const GLB_STANDARD = { version: "cabinet-v1", unit: "meter", up: "+Y", front: "+Z", origin: "bottom-center", maxBytes: 200 * 1024 * 1024, dimensionToleranceMm: 5, originToleranceMm: 2 } as const;
export type GlbDimensions = { widthMm: number; heightMm: number; depthMm: number };
export type GlbInspection = {
  standard: string; bytes: number; dimensions: GlbDimensions; min: number[]; max: number[];
  meshes: number; materials: number; triangles: number; transformsApplied: boolean;
  bottomCentered: boolean; compressed: boolean; warnings: string[];
  /** Explicitly confirmed front handle projection; module depth is carcass depth. */
  frontProjectionMm?: number;
};
export class GlbStandardError extends Error {}
type Accessor = { min?: number[]; max?: number[]; type: string; count: number; componentType: number; bufferView?: number; byteOffset?: number; sparse?: unknown };
type Node = { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] };
type Gltf = {
  asset?: { version?: string }; scene?: number; scenes?: { nodes?: number[] }[]; nodes?: Node[];
  meshes?: { name?: string; primitives: { attributes: { POSITION: number }; indices?: number; mode?: number; targets?: unknown[]; extensions?: Record<string, unknown> }[] }[];
  materials?: { name?: string }[]; accessors?: Accessor[];
  bufferViews?: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number; extensions?: Record<string, unknown> }[];
  buffers?: { uri?: string; byteLength: number }[]; images?: { uri?: string; mimeType?: string }[]; extensionsUsed?: string[];
  animations?: unknown[]; skins?: unknown[];
};
function fail(message: string): never { throw new GlbStandardError(message); }
const vector = (value: number[] | undefined, length: number, fallback: number[]) => {
  const result = value ?? fallback;
  if (result.length !== length || !result.every(Number.isFinite)) fail("GLB transform/bounds буруу байна.");
  return result;
};

/** Reads actual uncompressed positions. Compressed bounds are checked again by the Blender worker. */
export function inspectGlb(bytes: ArrayBuffer): GlbInspection {
  if (bytes.byteLength < 20 || bytes.byteLength > GLB_STANDARD.maxBytes) fail("GLB файл 200 MB-аас ихгүй байна.");
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) fail("GLB v2 header/length буруу байна.");
  let document: Gltf | undefined, binary: DataView | undefined;
  for (let offset = 12; offset < bytes.byteLength;) {
    if (offset + 8 > bytes.byteLength) fail("GLB chunk тасарсан байна.");
    const length = view.getUint32(offset, true), kind = view.getUint32(offset + 4, true);
    if (length % 4 || offset + 8 + length > bytes.byteLength) fail("GLB chunk length буруу байна.");
    if (offset === 12 && kind !== 0x4e4f534a) fail("Эхний GLB chunk JSON байна.");
    if (kind === 0x4e4f534a) {
      if (document || length > 16 * 1024 * 1024) fail("GLB JSON chunk буруу байна.");
      try { document = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, offset + 8, length))); }
      catch { fail("GLB JSON уншигдахгүй байна."); }
    }
    if (kind === 0x004e4942) {
      if (binary) fail("GLB олон BIN chunk агуулж байна.");
      binary = new DataView(bytes, offset + 8, length);
    }
    offset += 8 + length;
  }
  const gltf = document;
  if (!gltf || gltf.asset?.version !== "2.0" || !gltf.meshes?.length || !binary) fail("GLB v2 mesh болон BIN шаардлагатай.");
  if (gltf.animations?.length || gltf.skins?.length || gltf.meshes.some(mesh => mesh.primitives.some(p => p.targets?.length))) fail("Static GLB шаардлагатай: animation, skin, morph дэмжихгүй.");
  if (gltf.buffers?.some(buffer => buffer.uri) || gltf.images?.some(image => image.uri)) fail("Mesh, texture нь GLB дотор embedded байна; external/data URI зөвшөөрөхгүй.");
  if (gltf.images?.some(image => image.mimeType === "image/ktx2") || gltf.extensionsUsed?.some(extension => ["KHR_texture_basisu", "EXT_meshopt_compression"].includes(extension))) fail("Боловсруулсан Meshopt/KTX2 delivery биш, original PNG/JPG texture-тэй GLB upload хийнэ үү. Blender worker энэ delivery format-ийг дахин import хийхгүй.");
  const nodes = gltf.nodes ?? [];
  if (nodes.length > 20000) fail("GLB хэт олон node агуулж байна.");
  const scene = gltf.scenes?.[gltf.scene ?? 0];
  if (!scene?.nodes?.length) fail("GLB default scene хоосон байна.");
  const bounds = new Box3(); let triangles = 0, placedMeshes = 0, processedVertices = 0, applied = true, compressed = false;
  const visited = new Set<number>();
  const walk = (index: number, parent: Matrix4, depth: number) => {
    if (depth > 100 || visited.has(index) || !nodes[index]) fail("GLB node cycle/reference буруу байна.");
    visited.add(index);
    const node = nodes[index];
    const local = node.matrix ? new Matrix4().fromArray(vector(node.matrix, 16, [])) : new Matrix4().compose(
      new Vector3().fromArray(vector(node.translation, 3, [0, 0, 0])),
      new Quaternion().fromArray(vector(node.rotation, 4, [0, 0, 0, 1])),
      new Vector3().fromArray(vector(node.scale, 3, [1, 1, 1])));
    applied = applied && local.elements.every((value, i) => Math.abs(value - (i % 5 === 0 ? 1 : 0)) < 1e-6);
    const world = parent.clone().multiply(local);
    if (node.mesh !== undefined) {
      const mesh = gltf.meshes![node.mesh]; if (!mesh) fail("GLB mesh reference буруу байна.");
      placedMeshes++;
      for (const primitive of mesh.primitives) {
        if ((primitive.mode ?? 4) !== 4) fail("Mesh нь TRIANGLES байна.");
        const accessor = gltf.accessors?.[primitive.attributes?.POSITION];
        if (!accessor || accessor.type !== "VEC3" || !Number.isSafeInteger(accessor.count) || accessor.count < 1 || accessor.count > 12_000_000 || accessor.sparse) fail("GLB POSITION accessor буруу эсвэл sparse байна.");
        processedVertices += accessor.count;
        if (processedVertices > 12_000_000) fail("GLB давтагдсан geometry-ийн нийт хэмжээ хэт их байна.");
        const bufferView = accessor.bufferView === undefined ? undefined : gltf.bufferViews?.[accessor.bufferView];
        const encoded = Boolean(primitive.extensions?.KHR_draco_mesh_compression || bufferView?.extensions?.EXT_meshopt_compression);
        compressed ||= encoded;
        const meshBounds = new Box3();
        if (encoded) {
          meshBounds.set(new Vector3().fromArray(vector(accessor.min, 3, [])), new Vector3().fromArray(vector(accessor.max, 3, [])));
          if (meshBounds.isEmpty()) fail("Compressed GLB bounds буруу байна.");
        } else {
          if (!bufferView || bufferView.buffer !== 0 || accessor.componentType !== 5126) fail("POSITION float32 embedded buffer шаардлагатай.");
          const stride = bufferView.byteStride ?? 12, start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
          const end = start + (accessor.count - 1) * stride + 12;
          if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(stride) || stride < 12 || stride > 252 || end > binary!.byteLength || end > (bufferView.byteOffset ?? 0) + bufferView.byteLength) fail("GLB POSITION buffer тасарсан байна.");
          for (let i = 0; i < accessor.count; i++) {
            const point = new Vector3(binary!.getFloat32(start + i * stride, true), binary!.getFloat32(start + i * stride + 4, true), binary!.getFloat32(start + i * stride + 8, true));
            if (![point.x, point.y, point.z].every(Number.isFinite)) fail("GLB NaN/Infinity vertex агуулж байна.");
            meshBounds.expandByPoint(point);
          }
        }
        bounds.union(meshBounds.applyMatrix4(world));
        triangles += (primitive.indices === undefined ? accessor.count : gltf.accessors?.[primitive.indices]?.count ?? 0) / 3;
      }
    }
    for (const child of node.children ?? []) walk(child, world, depth + 1);
  };
  for (const root of scene.nodes) walk(root, new Matrix4(), 0);
  const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
  if (![size.x, size.y, size.z].every(value => Number.isFinite(value) && value > 0.000001) || !placedMeshes) fail("GLB dimensions хоосон/буруу байна.");
  const bottomCentered = Math.max(Math.abs(center.x), Math.abs(bounds.min.y), Math.abs(center.z)) <= GLB_STANDARD.originToleranceMm / 1000;
  const warnings = ["+Y дээш, +Z нүүрэн талыг preview дээр хүн батална."];
  if (compressed) warnings.push("Compressed POSITION bounds-ийг worker decode хийж дахин шалгана.");
  for (const [kind, values] of [["mesh", gltf.meshes], ["material", gltf.materials ?? []]] as const) {
    const names = values.map(value => value.name ?? "");
    if (names.some(name => !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(name)) || new Set(names).size !== names.length) warnings.push(`${kind} нэрийг ASCII, unique, surface зориулалтаар нэрлэнэ.`);
  }
  return { standard: GLB_STANDARD.version, bytes: bytes.byteLength, dimensions: { widthMm: size.x * 1000, heightMm: size.y * 1000, depthMm: size.z * 1000 }, min: bounds.min.toArray(), max: bounds.max.toArray(), meshes: placedMeshes, materials: gltf.materials?.length ?? 0, triangles, transformsApplied: applied, bottomCentered, compressed, warnings };
}

export function validateCabinetGlb(report: GlbInspection, expected: GlbDimensions) {
  const errors: string[] = [];
  const projection = report.frontProjectionMm ?? 0;
  if (!Number.isFinite(projection) || projection < 0 || projection > 100) errors.push("Бариулын projection 0–100 мм байна.");
  for (const key of ["widthMm", "heightMm", "depthMm"] as const) {
    const required = expected[key] + (key === "depthMm" ? projection : 0);
    if (!Number.isFinite(required) || Math.abs(report.dimensions[key] - required) > GLB_STANDARD.dimensionToleranceMm) errors.push(`${key}: GLB ${Math.round(report.dimensions[key])} мм / module ${expected[key]} мм${key === "depthMm" && projection ? ` + бариул ${projection} мм` : ""}.`);
  }
  if (!report.bottomCentered) errors.push("Origin доод төвд биш. Blender дээр origin/geometry-г засна уу.");
  if (!report.transformsApplied) errors.push("Node transform applied биш. Rotation, scale, translation-ийг mesh vertex-д bake хийнэ үү.");
  return errors;
}
