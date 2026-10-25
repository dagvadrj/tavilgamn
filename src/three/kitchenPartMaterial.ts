import { Mesh, MeshStandardMaterial, TangentSpaceNormalMap, type Group } from "three";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import type { KitchenMaterialTextureSet } from "./kitchenMaterialTextures";
import type { KitchenCabinetSurface } from "@/lib/kitchenMaterials";
import { kitchenSurfaceClassifier } from "./kitchenSurfaceClassification";
import { prepareKitchenTextureCoordinates } from "./kitchenTextureCoordinates";

/** Called on an isolated part BEFORE child handles are attached. Shared GLBs stay intact. */
export function applyKitchenPartMaterial(
  part: Group,
  definition: KitchenMaterialDefinition,
  textures: KitchenMaterialTextureSet,
  target?: KitchenCabinetSurface | "cabinet",
) {
  const owned: MeshStandardMaterial[] = [];
  const classify = target ? kitchenSurfaceClassifier(part) : undefined;
  part.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const apply = (source: MeshStandardMaterial) => {
      const surface = classify?.(object, source);
      if (target && (!surface || (target !== "cabinet" && surface !== target))) return source;
      const material = source.clone();
      material.color.set(definition.baseColor);
      material.roughness = definition.roughness;
      material.metalness = definition.metalness;
      // Explicit solid colour must replace the old authored diffuse texture too.
      material.map = textures.baseColor ?? null;
      material.normalMap = textures.normal ?? null;
      material.normalMapType = TangentSpaceNormalMap;
      material.normalScale.set(1, 1);
      material.bumpMap = null;
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
  prepareKitchenTextureCoordinates(part);
  return () => owned.forEach((material) => material.dispose());
}
