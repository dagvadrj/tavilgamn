import type { KitchenCatalogModule, KitchenCatalogVariant } from "./kitchenModuleCatalog";

const TYPE_NAME: Record<KitchenCatalogModule["cabinetType"], string> = {
  base: "доод шүүгээ",
  wall: "дээд шүүгээ",
  tall: "өндөр шүүгээ",
  corner: "булангийн шүүгээ",
  appliance: "төхөөрөмж",
};

/** Cyrillic is what a buyer reads; Latin-only names are admin codes or transliteration. */
const READABLE = /[Ѐ-ӿ]/;

function openingDetail(variant: Pick<KitchenCatalogVariant, "opening" | "doorCount" | "drawerCount">): string {
  switch (variant.opening) {
    case "drawers":
      return `${variant.drawerCount || 1} шургуулга`;
    case "open":
      return "задгай";
    case "sink":
      return "угаалтуурын";
    case "hob":
      return "плитаны";
    case "oven":
      return "зуухны";
    case "hood":
      return "сорогч";
    case "refrigerator":
      return "хөргөгч";
    default: {
      const doors = `${variant.doorCount || 1} хаалга`;
      return variant.drawerCount ? `${doors}, ${variant.drawerCount} шургуулга` : doors;
    }
  }
}

/**
 * The name a catalog card shows. Admin names in Cyrillic stay as written;
 * a Latin code such as «BASE1000mm840mm598mm2h-Z596mm» or «undur box 1,2m»
 * becomes «1000 мм доод шүүгээ · 2 хаалга» from the module's own data.
 */
export function kitchenModelDisplayName(
  module: Pick<KitchenCatalogModule, "name" | "cabinetType" | "widthMm">,
  variant: Pick<KitchenCatalogVariant, "modelName" | "opening" | "doorCount" | "drawerCount">,
): string {
  const given = (variant.modelName || module.name).trim();
  if (READABLE.test(given)) return given;
  return `${module.widthMm} мм ${TYPE_NAME[module.cabinetType]} · ${openingDetail(variant)}`;
}

/** The admin's model name when a buyer can read it; otherwise undefined, so callers fall back to the cabinet's own label. */
export function readableModelName(name: string | null | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed && READABLE.test(trimmed) ? trimmed : undefined;
}
