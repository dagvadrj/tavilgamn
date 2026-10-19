import { Mesh, MeshStandardMaterial, type Group } from "three";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import type { KitchenMaterialTextureSet } from "./kitchenMaterialTextures";

/** Called on an isolated part BEFORE child handles are attached. Shared GLBs stay intact. */
export function applyKitchenPartMaterial(
  part: Group,
  definition: KitchenMaterialDefinition,
  textures: KitchenMaterialTextureSet,
) {
  const owned: MeshStandardMaterial[] = [];
  part.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const apply = (source: MeshStandardMaterial) => {
      const material = source.clone();
      material.color.set(definition.baseColor);
      material.roughness = definition.roughness;
      material.metalness = definition.metalness;
      // Explicit solid colour must replace the old authored diffuse texture too.
      material.map = textures.baseColor ?? null;
      material.normalMap = textures.normal ?? null;
      material.roughnessMap = textures.roughness ?? null;
      material.metalnessMap = textures.metalness ?? null;
      material.needsUpdate = true;
      owned.push(material);
      return material;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(apply)
      : apply(object.material as MeshStandardMaterial);
  });
  return () => owned.forEach((material) => material.dispose());
}
