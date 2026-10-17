import * as THREE from "three";
import { authoredRoomSurface } from "./roomCutaway";
import { exportProductForAR } from "./productExport";

/** Flatten only room assemblies at their world transforms, excluding editor helpers. */
export function snapshotRoomForExport(scene: THREE.Scene) {
  scene.updateMatrixWorld(true);
  const root = new THREE.Group();
  const materials: THREE.Material[] = [];
  const eligible = (node: THREE.Object3D) => {
    let content = false;
    for (
      let parent: THREE.Object3D | null = node;
      parent;
      parent = parent.parent
    ) {
      if (parent.userData.exportExclude) return false;
      if (parent.userData.roomExport) content = true;
    }
    return content;
  };
  scene.traverse((node) => {
    if (eligible(node) && node.userData.deliveryPending)
      throw new Error("3D тавилга бүрэн ачаалсны дараа GLB татна уу.");
  });
  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !eligible(node)) return;
    const original = Array.isArray(node.material)
      ? node.material
      : [node.material];
    // Invisible picking volumes have no authored colour pass. Cutaway walls do.
    if (
      original.every(
        (material) =>
          !authoredRoomSurface(material).colorWrite ||
          authoredRoomSurface(material).opacity === 0,
      )
    )
      return;
    const copy = node.clone(false);
    copy.visible = true;
    copy.matrix.copy(node.matrixWorld);
    copy.matrixAutoUpdate = false;
    const cloned = original.map((material) => {
      const next = material.clone();
      Object.assign(next, authoredRoomSurface(material));
      materials.push(next);
      return next;
    });
    copy.material = Array.isArray(node.material) ? cloned : cloned[0];
    copy.userData = {};
    root.add(copy);
  });
  if (!root.children.length)
    throw new Error("Экспортлох өрөө бэлэн болоогүй байна.");
  return {
    root,
    dispose: () => materials.forEach((material) => material.dispose()),
  };
}
export async function exportRoomGlb(scene: THREE.Scene) {
  const snapshot = snapshotRoomForExport(scene);
  try {
    return await exportProductForAR(snapshot.root);
  } finally {
    snapshot.dispose();
  }
}
