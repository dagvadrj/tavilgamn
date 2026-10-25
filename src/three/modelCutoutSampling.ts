import * as THREE from "three";

/** Smooth authored alpha-mask edges when the canvas has multisample antialiasing. */
export function configureModelCutoutSampling(
  scene: THREE.Object3D,
  renderer: THREE.WebGLRenderer,
) {
  const multisampled = renderer.getContext?.().getContextAttributes?.()?.antialias === true;
  if (!multisampled) return;
  const visited = new Set<THREE.Material>();
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (visited.has(material)) continue;
      visited.add(material);
      // Blended glass keeps its authored transparency. Masked leaves and fabric
      // use coverage instead of a jagged one-sample discard at their silhouette.
      if (material.alphaTest <= 0 || material.transparent || material.alphaToCoverage) continue;
      material.alphaToCoverage = true;
      material.needsUpdate = true;
    }
  });
}
