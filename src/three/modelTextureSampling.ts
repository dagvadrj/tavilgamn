import * as THREE from "three";

/** Bound oblique texture filtering without changing images, UVs or color spaces. */
export function configureModelTextureSampling(
  scene: THREE.Object3D,
  renderer: THREE.WebGLRenderer,
) {
  const supported = renderer.capabilities?.getMaxAnisotropy?.() ?? 1;
  const maximum = Number.isFinite(supported) ? Math.max(1, supported) : 1;
  // Wood grain and fabric are commonly seen at grazing angles in the planner.
  // Eight taps improve those surfaces while remaining bounded on mobile GPUs.
  const budget = Math.min(8, maximum);
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) textures.add(value);
      }
    }
  });
  for (const texture of textures) {
    // Respect nearest/no-mip samplers intentionally authored by the asset.
    if (texture.magFilter !== THREE.LinearFilter ||
        (texture.minFilter !== THREE.LinearMipmapLinearFilter &&
         texture.minFilter !== THREE.NearestMipmapLinearFilter)) continue;
    const anisotropy = Math.min(maximum, Math.max(texture.anisotropy, budget));
    if (texture.anisotropy === anisotropy) continue;
    texture.anisotropy = anisotropy;
    texture.needsUpdate = true;
  }
}
