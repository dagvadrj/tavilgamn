import { Mesh, MeshStandardMaterial, type Material, type Object3D, type Texture } from "three";

/** glTF's implicit material is a rough metal. Unassigned furniture panels need
 * a neutral dielectric fallback; explicitly authored materials keep every value.
 */
export function configureModelDefaultMaterials(
  scene: Object3D,
  associations?: Map<Object3D | Material | Texture, { materials?: number }>,
) {
  if (!associations) return;
  const visited = new Set<Material>();
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (visited.has(material)) continue;
      visited.add(material);
      if (!(material instanceof MeshStandardMaterial) ||
          associations.get(material)?.materials !== undefined ||
          material.name || material.map || material.metalnessMap || material.roughnessMap ||
          material.metalness !== 1 || material.roughness !== 1) continue;
      material.metalness = 0;
      material.roughness = 0.65;
      material.userData.plannerUnassignedMaterial = true;
      material.needsUpdate = true;
    }
  });
}
