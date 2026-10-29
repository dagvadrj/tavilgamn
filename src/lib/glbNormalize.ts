import { Matrix4, Quaternion, Vector3 } from "three";

/**
 * Browser counterpart of scripts/models/standardize-cabinet.mjs: bakes node transforms
 * into vertices and moves the origin to bottom-centre. No scaling or rotation is inferred,
 * and node names are kept. Empty anchor nodes stay only when keepAnchors (assembly GLBs);
 * plain furniture drops them, since every node must then carry an identity transform.
 */
export async function normalizeGlbOrigin(file: File, keepAnchors = false): Promise<File> {
  const [{ WebIO, getBounds }, { KHRONOS_EXTENSIONS }, { flatten, transformMesh, prune }] =
    await Promise.all([
      import("@gltf-transform/core"),
      import("@gltf-transform/extensions"),
      import("@gltf-transform/functions"),
    ]);
  const io = new WebIO().registerExtensions(KHRONOS_EXTENSIONS);
  const doc = await io
    .readBinary(new Uint8Array(await file.arrayBuffer()))
    .catch(() => {
      throw new Error(
        "Compressed (Draco/Meshopt) GLB-г автоматаар засах боломжгүй. Шахаагүй GLB оруулна уу.",
      );
    });
  const root = doc.getRoot();
  if (
    root.listExtensionsUsed().some((extension) =>
      ["KHR_draco_mesh_compression", "EXT_meshopt_compression"].includes(
        extension.extensionName,
      ),
    )
  )
    throw new Error(
      "Compressed (Draco/Meshopt) GLB-г автоматаар засах боломжгүй. Шахаагүй GLB оруулна уу.",
    );
  if (root.listScenes().length !== 1 || root.listAnimations().length || root.listSkins().length)
    throw new Error("Нэг static scene-тэй GLB л автоматаар засагдана.");
  await doc.transform(flatten());
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const bounds = getBounds(scene);
  const offset = new Matrix4().makeTranslation(
    -(bounds.min[0] + bounds.max[0]) / 2,
    -bounds.min[1],
    -(bounds.min[2] + bounds.max[2]) / 2,
  );
  for (const node of scene.listChildren()) {
    const world = offset.clone().multiply(new Matrix4().fromArray(node.getWorldMatrix()));
    const mesh = node.getMesh();
    if (mesh) {
      // Meshes may be shared between nodes; bake into a per-node copy.
      const baked = mesh.clone();
      transformMesh(baked, world.toArray() as Parameters<typeof transformMesh>[1]);
      node.setMesh(baked).setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]);
    } else if (!keepAnchors) {
      node.dispose();
    } else {
      // Empty anchor nodes keep their name and move with the geometry.
      const t = new Vector3(), r = new Quaternion(), s = new Vector3();
      world.decompose(t, r, s);
      node.setTranslation(t.toArray()).setRotation(r.toArray() as [number, number, number, number]).setScale(s.toArray());
    }
  }
  await doc.transform(prune({ keepLeaves: true }));
  const bytes = await io.writeBinary(doc);
  return new File([bytes], file.name, { type: "model/gltf-binary", lastModified: Date.now() });
}
