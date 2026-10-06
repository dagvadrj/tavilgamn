import * as THREE from "three";

/** Only this product, in metres, with the currently selected appearance. */
export function snapshotProduct(root: THREE.Group) {
  root.traverse(node => {
    if (node.userData.deliveryPending && !node.userData.deliveryReady) throw new Error("Бүрэн чанартай 3D загвар ачаалж байна. Түр хүлээгээд дахин оролдоорой.");
  });
  const scene = root.clone(true), excluded: THREE.Object3D[] = [];
  scene.traverse(node => { if (node.userData.exportExclude) excluded.push(node); });
  excluded.forEach(node => node.removeFromParent());
  const materials = new Map<THREE.Material, THREE.Material>(), textures = new Map<THREE.Texture, THREE.Texture>();
  let meshes = 0;
  scene.traverse(node => {
    if (node.userData.productDelivery) node.visible = true;
    if (!(node instanceof THREE.Mesh)) return;
    meshes++;
    node.geometry = node.geometry.clone();
    const cloneMaterial = (original: THREE.Material) => {
      let copy = materials.get(original);
      if (!copy) {
        copy = original.clone(); materials.set(original, copy);
        for (const [key, value] of Object.entries(copy)) if (value instanceof THREE.Texture) {
          let texture = textures.get(value);
          if (!texture) { texture = value.clone(); textures.set(value, texture); }
          (copy as unknown as Record<string, unknown>)[key] = texture;
        }
      }
      return copy;
    };
    node.material = Array.isArray(node.material) ? node.material.map(cloneMaterial) : cloneMaterial(node.material);
  });
  scene.updateMatrixWorld(true);
  if (!meshes) throw new Error("3D загвар бэлэн болоогүй байна.");
  return { scene, dispose() {
    scene.traverse(node => { if (node instanceof THREE.Mesh) node.geometry.dispose(); });
    materials.forEach(material => material.dispose()); textures.forEach(texture => texture.dispose());
  } };
}

export async function exportProductForAR(root: THREE.Group) {
  const snapshot = snapshotProduct(root);
  let renderer: THREE.WebGLRenderer | undefined;
  const readableTextures = new Map<THREE.Texture, THREE.Texture>();
  try {
    const [{ GLTFExporter }, { decompress }] = await Promise.all([
      import("three/examples/jsm/exporters/GLTFExporter.js"),
      import("three/examples/jsm/utils/WebGLTextureUtils.js"),
    ]);
    const exporter = new GLTFExporter().setTextureUtils({
      decompress(texture, maxTextureSize) {
        const cached = readableTextures.get(texture);
        if (cached) return cached;
        // KTX2 surfaces need a GPU readback before they can be embedded in AR GLBs.
        // Own a separate, lazy context so exporting cannot resize the product canvas.
        renderer ??= new THREE.WebGLRenderer({ antialias: false });
        const readable = decompress(texture, Math.min(maxTextureSize ?? 2048, 2048), renderer);
        readableTextures.set(texture, readable);
        // glTF textures typically use flipY=false; the helper defaults to true.
        readable.flipY = texture.flipY;
        readable.channel = texture.channel;
        readable.offset.copy(texture.offset);
        readable.repeat.copy(texture.repeat);
        readable.center.copy(texture.center);
        readable.rotation = texture.rotation;
        readable.matrix.copy(texture.matrix);
        readable.matrixAutoUpdate = texture.matrixAutoUpdate;
        readable.userData = { ...texture.userData };
        return readable;
      },
    });
    const result = await exporter.parseAsync(snapshot.scene, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
    if (!(result instanceof ArrayBuffer)) throw new Error("AR загварыг бэлдэж чадсангүй.");
    return new Blob([result], { type: "model/gltf-binary" });
  } finally {
    readableTextures.forEach(texture => texture.dispose());
    if (renderer) { renderer.dispose(); renderer.forceContextLoss(); }
    snapshot.dispose();
  }
}
