import {
  Group,
  Mesh,
  Material,
  Texture,
  PropertyBinding,
  WebGLRenderer,
  type AnimationClip,
  type Object3D,
} from "three";

/** Snapshot only the explicitly designated kitchen assembly, never the room scene. */
export function snapshotKitchen(root: Group) {
  if (!root.userData.kitchenExport)
    throw new Error("Гарнитурын 3D хэсэг бэлэн болоогүй байна.");
  root.traverse((node) => {
    if (node.userData.deliveryPending && !node.userData.exportExclude) {
      throw new Error(
        "Бүрэн чанартай 3D загвар ачаалж байна. Түр хүлээгээд экспортоо дахин хийнэ үү.",
      );
    }
  });
  root.updateWorldMatrix(true, true);
  const copy = root.clone(true),
    remove: Object3D[] = [];
  const originals: Object3D[] = [],
    copies: Object3D[] = [];
  root.traverse((node) => originals.push(node));
  copy.traverse((node) => copies.push(node));
  const clonedById = new Map(
    originals.map((node, i) => [node.uuid, copies[i]]),
  );
  copy.traverse((node) => {
    // GLTFLoader uses plain Object3D nodes for authored connector sockets.
    // Preserve them and their child parts; omit rendering helpers and cameras.
    if (
      node.userData.exportExclude ||
      node.type === "PerspectiveCamera" ||
      node.type === "OrthographicCamera" ||
      node.type.endsWith("Light") ||
      node.type === "Line" ||
      node.type === "LineSegments" ||
      node.type === "Points"
    )
      remove.push(node);
  });
  remove.forEach((node) => node.removeFromParent());
  const included = new Set<string>();
  copy.traverse((node) => included.add(node.uuid));
  const animations: AnimationClip[] = [];
  root.traverse((node) => {
    for (const source of node.animations) {
      const clip = source.clone();
      clip.tracks = clip.tracks.flatMap((track) => {
        const binding = PropertyBinding.parseTrackName(track.name);
        const target = PropertyBinding.findNode(node, binding.nodeName);
        const cloned = target && clonedById.get(target.uuid);
        if (!cloned || !included.has(cloned.uuid)) return [];
        track.name = binding.nodeName
          ? track.name.replace(binding.nodeName, cloned.uuid)
          : cloned.uuid + track.name;
        return [track];
      });
      if (clip.tracks.length) {
        clip.name = `${source.name}-${animations.length + 1}`;
        animations.push(clip);
      }
    }
  });
  const materials = new Map<Material, Material>(),
    textures = new Map<Texture, Texture>();
  let meshes = 0;
  copy.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    meshes++;
    // Exports own their resources even if editing/removal continues during encoding.
    node.geometry = node.geometry.clone();
    function cloneMaterial(original: Material) {
      let next = materials.get(original);
      if (!next) {
        next = original.clone();
        materials.set(original, next);
        for (const [key, value] of Object.entries(next))
          if (value instanceof Texture) {
            let texture = textures.get(value);
            if (!texture) {
              texture = value.clone();
              textures.set(value, texture);
            }
            (next as unknown as Record<string, unknown>)[key] = texture;
          }
      }
      return next;
    }
    node.material = Array.isArray(node.material)
      ? node.material.map(cloneMaterial)
      : cloneMaterial(node.material);
  });
  if (!meshes) throw new Error("Экспортлох шүүгээ алга.");
  // The assembly coordinates are in meters; no fit-to-view scaling is applied.
  copy.updateMatrixWorld(true);
  return {
    scene: copy,
    animations,
    dispose() {
      copy.traverse((node) => {
        if (node instanceof Mesh) node.geometry.dispose();
      });
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
export async function encodeKitchenGlb(
  root: Group,
  includeAnimations = true,
): Promise<ArrayBuffer> {
  const snapshot = snapshotKitchen(root);
  let renderer: WebGLRenderer | undefined;
  const readableTextures = new Map<Texture, Texture>();
  try {
    const [{ GLTFExporter }, { decompress }] = await Promise.all([
      import("three/examples/jsm/exporters/GLTFExporter.js"),
      import("three/examples/jsm/utils/WebGLTextureUtils.js"),
    ]);
    const exporter = new GLTFExporter().setTextureUtils({
      decompress(texture, maxTextureSize) {
        const cached = readableTextures.get(texture);
        if (cached) return cached;
        // KTX2 textures need GPU readback before embedding them in a GLB.
        // Keep export work off the planner's canvas and allocate only if needed.
        renderer ??= new WebGLRenderer({ antialias: false });
        const readable = decompress(
          texture,
          Math.min(maxTextureSize ?? 2048, 2048),
          renderer,
        );
        readableTextures.set(texture, readable);
        // Retain the helper's flipY=true to undo GPU readback's reversed rows.
        readable.channel = texture.channel;
        readable.offset.copy(texture.offset);
        readable.repeat.copy(texture.repeat);
        readable.center.copy(texture.center);
        readable.rotation = texture.rotation;
        readable.matrix.copy(texture.matrix);
        readable.matrixAutoUpdate = texture.matrixAutoUpdate;
        readable.userData = { ...texture.userData, mimeType: "image/png" };
        return readable;
      },
    });
    const data = await exporter.parseAsync(snapshot.scene, {
      binary: true,
      onlyVisible: true,
      maxTextureSize: 2048,
      animations: includeAnimations ? snapshot.animations : [],
    });
    if (!(data instanceof ArrayBuffer))
      throw new Error("GLB экспорт амжилтгүй боллоо.");
    return data;
  } finally {
    readableTextures.forEach((texture) => texture.dispose());
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
    }
    snapshot.dispose();
  }
}
export function kitchenExportFilename(name: string, extension: "glb" | "skp") {
  const safe =
    name
      .replace(/[\x00-\x1f<>:"/\\|?*]/g, "-")
      .replace(/^[. ]+|[. ]+$/g, "")
      .slice(0, 80) || "kitchen";
  return `${safe}.${extension}`;
}
export function downloadKitchenFile(data: Blob, filename: string) {
  const url = URL.createObjectURL(data),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
