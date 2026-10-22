import { createCabinet, type ModularCabinet } from "./kitchenCabinets";
import { withOpening } from "./kitchenComponents";
import { kitchenVariantMatchesRole, kitchenVariantFromModule, type KitchenCatalogModule, type KitchenCatalogVariant } from "./kitchenModuleCatalog";

/** Keep the authored model's dimensions and opening so catalog matching retains its GLB. */
export function cabinetFromCatalog(
  module: KitchenCatalogModule,
  variant: KitchenCatalogVariant,
  id: string,
  ceilingHeight: number,
): ModularCabinet | null {
  if (!module.active || !variant.active || !variant.glbFile ||
    variant.assetValidationIssues?.length ||
    !module.variants.some(item => item.furnitureModelId === variant.furnitureModelId)) return null;
  // Appliance-only specs have no compatible cabinet geometry in this editor.
  if (module.cabinetType === "appliance") return null;
  const type = module.cabinetType === "corner" ? (module.depthMm <= 450 ? "wall" : "base") : module.cabinetType;
  if (!kitchenVariantMatchesRole(kitchenVariantFromModule(module, variant), { type, corner: module.cabinetType === "corner", opening: variant.opening })) return null;
  const cabinet = withOpening(createCabinet(type, id, module.widthMm, ceilingHeight), variant.opening);
  return {
    ...cabinet,
    width: module.widthMm,
    height: module.heightMm,
    depth: module.depthMm,
    variantId: variant.furnitureModelId,
    doorCount: variant.doorCount === 2 && module.widthMm >= 600 ? 2 : 1,
    drawerCount: variant.opening === "drawers" ? Math.max(1, Math.min(4, variant.drawerCount || 3)) : 0,
    fitToCeiling: false,
    corner: module.cabinetType === "corner",
    cornerSide: module.cabinetType === "corner" ? "right" : undefined,
    position: { ...cabinet.position, x: module.widthMm / 2, z: module.depthMm / 2 },
  };
}
