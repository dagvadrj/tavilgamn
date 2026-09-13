import { Group, Mesh, Material, Texture, type Object3D } from "three";

/** Snapshot only the explicitly designated kitchen assembly, never the room scene. */
export function snapshotKitchen(root: Group) {
  if (!root.userData.kitchenExport) throw new Error("Гарнитурын 3D хэсэг бэлэн болоогүй байна.");
  root.updateWorldMatrix(true, true);
  const copy = root.clone(true), remove: Object3D[] = [];
  copy.traverse(node => {
    if (node.userData.exportExclude || (!(node instanceof Mesh) && !(node instanceof Group))) remove.push(node);
  });
  remove.forEach(node => node.removeFromParent());
  const materials = new Map<Material, Material>(), textures = new Map<Texture, Texture>();
  let meshes = 0;
  copy.traverse(node => {
    if (!(node instanceof Mesh)) return;
    meshes++;
    // Exports own their resources even if editing/removal continues during encoding.
    node.geometry = node.geometry.clone();
    function cloneMaterial(original: Material) {
      let next = materials.get(original);
      if (!next) {
        next = original.clone(); materials.set(original, next);
        for (const [key, value] of Object.entries(next)) if (value instanceof Texture) {
          let texture = textures.get(value);
          if (!texture) { texture = value.clone(); textures.set(value, texture); }
          (next as unknown as Record<string, unknown>)[key] = texture;
        }
      }
      return next;
    }
    node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material);
  });
  if (!meshes) throw new Error("Экспортлох шүүгээ алга.");
  // The assembly coordinates are in meters; no fit-to-view scaling is applied.
  copy.updateMatrixWorld(true);
  return { scene: copy, dispose() {
    copy.traverse(node => { if (node instanceof Mesh) node.geometry.dispose(); });
    materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
  } };
}
export async function encodeKitchenGlb(root: Group): Promise<ArrayBuffer> {
  const snapshot = snapshotKitchen(root);
  try {
    const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
    const data = await new GLTFExporter().parseAsync(snapshot.scene, { binary: true, onlyVisible: true });
    if (!(data instanceof ArrayBuffer)) throw new Error("GLB экспорт амжилтгүй боллоо.");
    return data;
  } finally { snapshot.dispose(); }
}
export function kitchenExportFilename(name: string, extension: "glb" | "skp") {
  const safe = name.replace(/[\x00-\x1f<>:"/\\|?*]/g, "-").replace(/^[. ]+|[. ]+$/g, "").slice(0, 80) || "kitchen";
  return `${safe}.${extension}`;
}
export function downloadKitchenFile(data: Blob, filename: string) {
  const url = URL.createObjectURL(data), anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
