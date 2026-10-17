import type { Mesh, Object3D } from "three";

// Main cameras keep layer 0. Only the upward contact camera uses this extra layer.
export const ROOM_CONTACT_SHADOW_LAYER = 10;

/** Exclude room slabs/roofs and invisible selection meshes from furniture grounding. */
export function syncRoomContactShadowCasters(root: Object3D, furniture = false): void {
  const include = root.userData.roomContactCaster ?? furniture;
  const mesh = root as Mesh;
  if (mesh.isMesh) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const casts = include && mesh.castShadow && materials.some(material => material.visible && material.colorWrite && material.opacity > 0);
    if (casts) mesh.layers.enable(ROOM_CONTACT_SHADOW_LAYER);
    else mesh.layers.disable(ROOM_CONTACT_SHADOW_LAYER);
  }
  for (const child of root.children) syncRoomContactShadowCasters(child, include);
}
