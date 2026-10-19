import type { KitchenPartKind } from "./kitchenGlbAssembly";
import { KitchenModuleInputError } from "./kitchenModuleCatalog";

export const KITCHEN_ASSET_GROUPS = {
  cabinets: "Шүүгээ",
  appliances: "Цахилгаан хэрэгсэл",
  water: "Угаалтуур ба крант",
  extras: "Гэрэл ба нэмэлт",
  dining: "Хооллох хэсэг",
  parts: "Шүүгээний эд анги",
} as const;
export type KitchenAssetGroup = keyof typeof KITCHEN_ASSET_GROUPS;
export type KitchenAssetPlacement =
  "floor" | "countertop" | "wall" | "ceiling" | "cabinet";
type AssetDefinition = {
  label: string;
  group: Exclude<KitchenAssetGroup, "cabinets">;
  partKind: KitchenPartKind;
  placement: KitchenAssetPlacement;
};
export const KITCHEN_ASSET_TYPES = {
  oven: {
    label: "Шарах шүүгээ",
    group: "appliances",
    partKind: "appliance",
    placement: "floor",
  },
  microwave: {
    label: "Богино долгионы зуух",
    group: "appliances",
    partKind: "appliance",
    placement: "countertop",
  },
  cooktop: {
    label: "Тавцангийн плитка",
    group: "appliances",
    partKind: "appliance",
    placement: "countertop",
  },
  range: {
    label: "Бүтэн плитка / зуух",
    group: "appliances",
    partKind: "appliance",
    placement: "floor",
  },
  dishwasher: {
    label: "Аяга таваг угаагч",
    group: "appliances",
    partKind: "appliance",
    placement: "floor",
  },
  hood: {
    label: "Хиншүү сорогч",
    group: "appliances",
    partKind: "appliance",
    placement: "wall",
  },
  fridge: {
    label: "Хөргөгч",
    group: "appliances",
    partKind: "appliance",
    placement: "floor",
  },
  freezer: {
    label: "Хөлдөөгч",
    group: "appliances",
    partKind: "appliance",
    placement: "floor",
  },
  "wine-cooler": {
    label: "Дарсны хөргөгч",
    group: "appliances",
    partKind: "appliance",
    placement: "floor",
  },
  "sink-single": {
    label: "1 устай угаалтуур",
    group: "water",
    partKind: "sink",
    placement: "countertop",
  },
  "sink-double": {
    label: "2 устай угаалтуур",
    group: "water",
    partKind: "sink",
    placement: "countertop",
  },
  "sink-undermount": {
    label: "Тавцан доорх угаалтуур",
    group: "water",
    partKind: "sink",
    placement: "cabinet",
  },
  tap: {
    label: "Холигч / крант",
    group: "water",
    partKind: "tap",
    placement: "countertop",
  },
  "light-under": {
    label: "Шүүгээний доорх гэрэл",
    group: "extras",
    partKind: "lighting",
    placement: "wall",
  },
  "light-inside": {
    label: "Шүүгээний доторх гэрэл",
    group: "extras",
    partKind: "lighting",
    placement: "cabinet",
  },
  "light-pendant": {
    label: "Таазны унждаг гэрэл",
    group: "extras",
    partKind: "lighting",
    placement: "ceiling",
  },
  backsplash: {
    label: "Ханын хамгаалалт / плита",
    group: "extras",
    partKind: "backsplash",
    placement: "wall",
  },
  rail: {
    label: "Ханын рейл / өлгүүр",
    group: "extras",
    partKind: "wall-organizer",
    placement: "wall",
  },
  "open-shelf": {
    label: "Ханын ил тавиур",
    group: "extras",
    partKind: "wall-organizer",
    placement: "wall",
  },
  accessory: {
    label: "Бусад гал тогооны хэрэгсэл",
    group: "extras",
    partKind: "accessory",
    placement: "countertop",
  },
  "dining-table": {
    label: "Хоолны ширээ",
    group: "dining",
    partKind: "dining-table",
    placement: "floor",
  },
  "dining-chair": {
    label: "Хоолны сандал",
    group: "dining",
    partKind: "dining-chair",
    placement: "floor",
  },
  "bar-stool": {
    label: "Текний өндөр сандал",
    group: "dining",
    partKind: "bar-stool",
    placement: "floor",
  },
} as const satisfies Record<string, AssetDefinition>;
export type KitchenAssetType = keyof typeof KITCHEN_ASSET_TYPES;
export type KitchenAsset = {
  version: 1;
  type: KitchenAssetType;
  installation: "integrated" | "freestanding";
  placement: KitchenAssetPlacement;
};
export function parseKitchenAsset(value: unknown): KitchenAsset {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new KitchenModuleInputError(
      "Гал тогооны хэрэгслийн төрөл сонгоно уу.",
    );
  const raw = value as Record<string, unknown>;
  if (
    raw.version !== 1 ||
    typeof raw.type !== "string" ||
    !Object.hasOwn(KITCHEN_ASSET_TYPES, raw.type) ||
    !["integrated", "freestanding"].includes(String(raw.installation))
  )
    throw new KitchenModuleInputError(
      "Гал тогооны хэрэгслийн ангилал буруу байна.",
    );
  const type = raw.type as KitchenAssetType;
  return {
    version: 1,
    type,
    installation: raw.installation as KitchenAsset["installation"],
    placement:
      raw.installation === "integrated"
        ? "cabinet"
        : KITCHEN_ASSET_TYPES[type].placement,
  };
}
export function kitchenAsset(specifications: unknown): KitchenAsset | null {
  try {
    const value = (specifications as Record<string, unknown>)?.kitchenAsset;
    return parseKitchenAsset(
      typeof value === "string" ? JSON.parse(value) : value,
    );
  } catch {
    return null;
  }
}
export function assetGroup(asset: KitchenAsset): KitchenAssetGroup {
  return KITCHEN_ASSET_TYPES[asset.type].group;
}
export function cabinetFamily(code: string) {
  return code.startsWith("CORNER-WALL-")
    ? "corner-wall"
    : code.startsWith("FRIDGE-WALL-")
      ? "over-fridge"
      : code.startsWith("ISLAND-")
        ? "island"
        : code.startsWith("CORNER-")
          ? "corner"
          : code.startsWith("WALL-")
            ? "wall"
            : code.startsWith("TALL-")
              ? "tall"
              : "base";
}
export const CABINET_FAMILIES = {
  base: "Доод шүүгээ",
  wall: "Дээд шүүгээ",
  tall: "Өндөр шүүгээ",
  corner: "Булангийн доод шүүгээ",
  "corner-wall": "Булангийн дээд шүүгээ",
  "over-fridge": "Хөргөгчний дээд шүүгээ",
  island: "Гал тогооны арал",
} as const;
