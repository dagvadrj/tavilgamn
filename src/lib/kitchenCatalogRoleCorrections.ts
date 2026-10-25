import { roomWalls, type ModularKitchen } from "./kitchenCabinets";
import type { KitchenCatalogModule } from "./kitchenModuleCatalog";
import { applyKitchenCatalogVariants } from "./kitchenModuleCatalog";
import { componentTypes } from "./kitchenComponents";
import { resolveElevations, snapCabinet } from "./kitchenPlacement";

/** Only migrate a saved SKU when its catalog explicitly records an approved role correction. */
export function reconcileKitchenCatalog(kitchen: ModularKitchen, modules: KitchenCatalogModule[]): ModularKitchen {
  let changed = false;
  const cabinets = kitchen.cabinets.map(cabinet => {
    const catalogModule = modules.find(item => item.active && item.variants.some(v => v.furnitureModelId === cabinet.variantId && v.active));
    const variant = catalogModule?.variants.find(item => item.furnitureModelId === cabinet.variantId);
    const correction = variant?.configuration.catalogRoleCorrection as { from?: string; to?: string } | undefined;
    if (!catalogModule || !correction || correction.from !== cabinet.type || correction.to !== "wall" || catalogModule.cabinetType !== "wall" ||
      cabinet.corner || cabinet.width !== catalogModule.widthMm || cabinet.height !== catalogModule.heightMm || cabinet.depth !== catalogModule.depthMm)
      return cabinet;
    const updated = { ...cabinet, type: "wall" as const, autoElevation: true, fitToCeiling: false };
    updated.position = snapCabinet(updated, updated.position, [], roomWalls(kitchen.room)).position;
    if (updated.components) updated.components = updated.components.filter(part => componentTypes(updated).includes(part.type));
    changed = true;
    return updated;
  });
  return applyKitchenCatalogVariants(changed ? resolveElevations({ ...kitchen, cabinets }) : kitchen, modules);
}
