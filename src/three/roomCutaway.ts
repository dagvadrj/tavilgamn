import * as THREE from "three";

type AuthoredSurface = Pick<THREE.Material, "opacity" | "transparent" | "depthWrite" | "colorWrite">;
const authored = new WeakMap<THREE.Material, AuthoredSurface>();

/** Export owns a copy; recover wall visibility without changing the live view. */
export function authoredRoomSurface(material: THREE.Material): AuthoredSurface {
  return authored.get(material) ?? { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite, colorWrite: material.colorWrite };
}

/** Hide the color pass completely while retaining physical wall/door shadows. */
export function applyRoomCutaway(root: THREE.Object3D, opacity: number) {
  root.userData.cutawayOpacity = opacity;
  root.traverse((object) => {
    if (object.userData.cutawayDecoration) object.visible = opacity > 0;
    if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      let original = authored.get(material);
      if (!original) {
        original = { opacity: material.opacity, transparent: material.transparent,
          depthWrite: material.depthWrite, colorWrite: material.colorWrite };
        authored.set(material, original);
      }
      const transparent = original.transparent || opacity < 1;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = original.opacity * opacity;
      material.depthWrite = original.depthWrite && opacity === 1;
      material.colorWrite = original.colorWrite && opacity > 0;
    }
  });
}

/** Three raycasting visits invisible descendants unless recursion is stopped. */
export function cutawayRaycast(this: THREE.Object3D) {
  if ((this.userData.cutawayOpacity ?? this.parent?.userData.cutawayOpacity ?? 1) < 0.2)
    return false;
}
