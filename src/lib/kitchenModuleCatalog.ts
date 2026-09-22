export const KITCHEN_OPENINGS = ["doors", "drawers", "open", "sink", "hob", "oven", "hood", "refrigerator"] as const;
export type KitchenOpening = (typeof KITCHEN_OPENINGS)[number];

export type KitchenCatalogVariant = {
  furnitureModelId: string;
  productId: string;
  modelName: string;
  variantCode: string;
  opening: KitchenOpening;
  doorCount: number;
  drawerCount: number;
  configuration: Record<string, unknown>;
  isDefault: boolean;
  sortOrder: number;
  active: boolean;
  glbFile: string | null;
  glbUrl: string | null;
  thumbnailUrl: string | null;
  processingStatus: string;
};

export type KitchenCatalogModule = {
  id: string;
  code: string;
  name: string;
  cabinetType: "base" | "wall" | "tall" | "corner" | "appliance";
  widthMm: number;
  heightMm: number;
  depthMm: number;
  active: boolean;
  variants: KitchenCatalogVariant[];
};

export type KitchenModelCandidate = {
  id: string;
  productId: string;
  name: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  glbReady: boolean;
  processingStatus: string;
  linked: boolean;
};

type CabinetMatch = {
  variantId?: string;
  type: "base" | "wall" | "tall";
  width: number;
  height: number;
  depth: number;
  opening?: KitchenOpening;
  corner?: boolean;
};

export function matchingKitchenVariants(modules: KitchenCatalogModule[], cabinet: CabinetMatch) {
  const cabinetType = cabinet.corner ? "corner" : cabinet.type;
  const opening = cabinet.opening ?? "doors";
  return modules
    .filter((module) => module.active && module.cabinetType === cabinetType && module.widthMm === cabinet.width && module.heightMm === cabinet.height && module.depthMm === cabinet.depth)
    .flatMap((module) => module.variants)
    .filter((variant) => variant.active && !!variant.glbFile && variant.opening === opening);
}

export function preferredKitchenVariant(modules: KitchenCatalogModule[], cabinet: CabinetMatch) {
  const variants = matchingKitchenVariants(modules, cabinet);
  return variants.find((variant) => variant.furnitureModelId === cabinet.variantId)
    ?? variants.find((variant) => variant.isDefault)
    ?? variants[0];
}

export function applyKitchenCatalogVariants<T extends { cabinets: CabinetMatch[] }>(kitchen: T, modules: KitchenCatalogModule[]): T {
  if (!modules.some((module) => module.variants.length)) return kitchen;
  let changed = false;
  const cabinets = kitchen.cabinets.map((cabinet) => {
    const preferred = preferredKitchenVariant(modules, cabinet);
    if (preferred?.furnitureModelId === cabinet.variantId) return cabinet;
    changed = true;
    if (preferred) return { ...cabinet, variantId: preferred.furnitureModelId };
    const { variantId: _variantId, ...withoutVariant } = cabinet;
    return withoutVariant;
  });
  return changed ? { ...kitchen, cabinets } : kitchen;
}

export class KitchenModuleInputError extends Error {}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseKitchenVariantInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new KitchenModuleInputError("Variant мэдээлэл буруу байна.");
  const raw = value as Record<string, unknown>;
  const modelId = typeof raw.modelId === "string" ? raw.modelId : "";
  const moduleId = typeof raw.moduleId === "string" ? raw.moduleId : "";
  const opening = typeof raw.opening === "string" ? raw.opening : "";
  const variantCode = typeof raw.variantCode === "string" ? raw.variantCode.trim().toUpperCase() : "";
  const integer = (input: unknown, fallback: number) => input === undefined ? fallback : Number(input);
  const doorCount = integer(raw.doorCount, 0), drawerCount = integer(raw.drawerCount, 0), sortOrder = integer(raw.sortOrder, 0);
  if (!UUID.test(modelId) || !UUID.test(moduleId)) throw new KitchenModuleInputError("Model эсвэл module ID буруу байна.");
  if (!(KITCHEN_OPENINGS as readonly string[]).includes(opening)) throw new KitchenModuleInputError("Нээлтийн төрөл буруу байна.");
  if (!/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(variantCode)) throw new KitchenModuleInputError("Variant code 2–80 тэмдэгт байна.");
  if (![doorCount, drawerCount, sortOrder].every(Number.isSafeInteger) || doorCount < 0 || doorCount > 2 || drawerCount < 0 || drawerCount > 4 || sortOrder < 0 || sortOrder > 10000) {
    throw new KitchenModuleInputError("Хаалга, шургуулга эсвэл эрэмбийн утга буруу байна.");
  }
  return { modelId, moduleId, payload: { variantCode, opening, doorCount, drawerCount,
    isDefault: raw.isDefault === true, sortOrder, configuration: {} } };
}

export function parseVariantState(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new KitchenModuleInputError("Variant мэдээлэл буруу байна.");
  const raw = value as Record<string, unknown>;
  if (typeof raw.modelId !== "string" || !UUID.test(raw.modelId) || typeof raw.active !== "boolean") throw new KitchenModuleInputError("Variant төлөв буруу байна.");
  return { modelId: raw.modelId, active: raw.active };
}
