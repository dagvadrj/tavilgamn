import type { ModularKitchen } from "./kitchenCabinets";
import type { KitchenCatalogVariant } from "./kitchenModuleCatalog";

/** Complete catalog GLBs own their worktop, appliances and trim. Generate these
 * fittings only for cabinets that are actually rendered procedurally. */
export function kitchenForGeneratedParts(
  kitchen: ModularKitchen,
  models?: Record<string, KitchenCatalogVariant>,
): ModularKitchen {
  const cabinets = kitchen.cabinets.filter(cabinet =>
    !cabinet.variantId || !models?.[cabinet.variantId]?.glbFile,
  );
  return cabinets.length === kitchen.cabinets.length ? kitchen : { ...kitchen, cabinets };
}
