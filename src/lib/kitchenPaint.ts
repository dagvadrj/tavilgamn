import type { KitchenMaterialDefinition } from "./kitchenMaterials";

/** Store custom paint in the existing, persisted material ID fields. */
export function kitchenPaintMaterial(color: string): KitchenMaterialDefinition | undefined {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return undefined;
  const baseColor = color.toUpperCase();
  return {
    id: `paint_${color.slice(1).toLowerCase()}`,
    name: `Өнгө ${baseColor}`,
    surfaceKind: "general",
    baseColor,
    roughness: 0.65,
    metalness: 0,
    texturePaths: {},
  };
}

export function resolveKitchenPaintMaterial(
  id: string | undefined,
  definitions: Record<string, KitchenMaterialDefinition> = {},
): KitchenMaterialDefinition | undefined {
  if (!id) return undefined;
  return definitions[id] ?? (/^paint_[0-9a-f]{6}$/.test(id) ? kitchenPaintMaterial(`#${id.slice(6)}`) : undefined);
}
