import { Mesh, MeshStandardMaterial, type Material, type Object3D, type Texture } from "three";

type GltfMaterialDefinition = {
  pbrMetallicRoughness?: { metallicFactor?: number; metallicRoughnessTexture?: unknown };
};

/** glTF's implicit material is a rough metal. Unassigned furniture panels need
 * a neutral dielectric fallback; explicitly authored materials keep every value.
 * Authored materials that simply omit metallicFactor (common in converted scans)
 * also inherit metal = 1, which renders fabric and leather near-black, so those
 * become dielectric too. An explicit metallicFactor, or a metal texture, is kept.
 */
export function configureModelDefaultMaterials(
  scene: Object3D,
  associations?: Map<Object3D | Material | Texture, { materials?: number }>,
  definitions?: GltfMaterialDefinition[],
) {
  if (!associations) return;
  const visited = new Set<Material>();
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (visited.has(material)) continue;
      visited.add(material);
      const index = associations.get(material)?.materials;
      const pbr = index === undefined ? undefined : definitions?.[index]?.pbrMetallicRoughness;
      if (material instanceof MeshStandardMaterial && index !== undefined && definitions?.[index] &&
          pbr?.metallicFactor === undefined && !pbr?.metallicRoughnessTexture &&
          !material.metalnessMap && material.metalness === 1) {
        material.metalness = 0;
        material.userData.plannerImplicitMetalness = true;
        material.needsUpdate = true;
        continue;
      }
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
