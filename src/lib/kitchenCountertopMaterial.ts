import type { Finish } from "./kitchen";
import type { ModularKitchen } from "./kitchenCabinets";
import type { KitchenMaterialDefinition } from "./kitchenMaterials";
import { kitchenMaterialGroup } from "./kitchenMaterialGroups";
import { resolveKitchenPaintMaterial } from "./kitchenPaint";

/** Apply a worktop finish to the complete kitchen without changing cabinet finishes or geometry. */
export function withKitchenCountertopMaterial(
  kitchen: ModularKitchen,
  id: string | undefined,
  definitions: Record<string, KitchenMaterialDefinition>,
): ModularKitchen {
  const definition = resolveKitchenPaintMaterial(id, definitions);
  if (id && (!definition || !["general", "countertop"].includes(definition.surfaceKind)))
    throw new Error("Тавцанд тохирох материал сонгоно уу.");
  const group = definition ? kitchenMaterialGroup(definition) : "stone";
  const finish: Finish = id && ["oak", "walnut", "marble", "concrete", "matte", "gloss"].includes(id)
    ? id as Finish : group === "wood" ? "oak" : group === "stone" ? "marble" : "matte";
  return {
    ...kitchen,
    countertop: {
      ...kitchen.countertop,
      material: group === "wood" ? "wood" : group === "stone" ? "granite" : "laminate",
      finish, materialId: id, color: undefined,
    },
    ...(kitchen.countertopLayout ? { countertopLayout: { mode: "manual" as const, panels: kitchen.countertopLayout.panels.map(top => ({
      ...top, material: (group === "wood" ? "wood" : group === "stone" ? "granite" : "laminate") as ModularKitchen["countertop"]["material"],
      finish, materialId: id, color: undefined,
    })) } } : {}),
    cabinets: kitchen.cabinets.map(cabinet => !cabinet.components?.some(part => part.type === "worktop") ? cabinet : {
      ...cabinet,
      components: cabinet.components.map(part => part.type === "worktop"
        ? { ...part, model: finish, finish, color: undefined } : part),
    }),
  };
}
