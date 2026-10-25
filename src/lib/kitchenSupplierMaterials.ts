import collection from "../../public/materials/b2b-f/planner-materials.json";
import { normalizeKitchenMaterials, type KitchenMaterialDefinition } from "./kitchenMaterials";

const supplierMaterials = normalizeKitchenMaterials(collection.materials);

/** Keep administrator materials authoritative and include the local supplier library. */
export function withKitchenSupplierMaterials(materials: KitchenMaterialDefinition[]) {
  const definitions = new Map(materials.map(material => [material.id, material]));
  for (const material of supplierMaterials) if (!definitions.has(material.id)) definitions.set(material.id, material);
  return [...definitions.values()];
}
