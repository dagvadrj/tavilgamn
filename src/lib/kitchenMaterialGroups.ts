import type { KitchenMaterialDefinition } from "./kitchenMaterials";

export const KITCHEN_MATERIAL_GROUPS = [
  ["all", "Бүгд"], ["stone", "Чулуу"], ["wood", "Мод"], ["color", "Дан өнгө"], ["other", "Бусад"],
] as const;
export type KitchenMaterialGroup = (typeof KITCHEN_MATERIAL_GROUPS)[number][0];

/** Classify the decor appearance, not the board's manufacturing composition. */
export function kitchenMaterialGroup(material: KitchenMaterialDefinition): Exclude<KitchenMaterialGroup, "all"> {
  const name = `${material.id} ${material.name}`.toLowerCase();
  if (/\bh\d{3,4}\b|oak|walnut|wood|pine|ash\b|beech|царс|хушга|мод/.test(name)) return "wood";
  if (/marble|granite|concrete|travertine|pietra|titanite|slate|chromix|гантиг|боржин|бетон|чулуу/.test(name)) return "stone";
  if (/\b[uw]\d{3,4}\b|^paint_|matte|gloss/.test(name) || !material.texturePaths.baseColor) return "color";
  return "other";
}
