import {
  KitchenAssemblyInputError,
  parseKitchenGlbAssembly,
  type KitchenPartKind,
} from "./kitchenGlbAssembly";
export const KITCHEN_OPENINGS = [
  "doors",
  "drawers",
  "open",
  "sink",
  "hob",
  "oven",
  "hood",
  "refrigerator",
] as const;
export type KitchenOpening = (typeof KITCHEN_OPENINGS)[number];

export type KitchenCatalogVariant = {
  assetValidationIssues?: string[];
  frontProjectionMm?: number;
  mount?: "floor" | "wall" | "floor-wall" | "corner";
  cabinetType?: "base" | "wall" | "tall" | "corner" | "appliance";
  physicalSize?: boolean;
  nominalSizeMm?: { width: number; height: number; depth: number };
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
  previewGlbFile: string | null;
  previewGlbUrl: string | null;
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
  asset?: import("./kitchenAssetCatalog").KitchenAsset | null;
  glbFile?: string | null;
  thumbnailUrl?: string | null;
  partKind?: KitchenPartKind | null;
  nodeNames?: string[];
  archivedAt?: string | null;
  id: string;
  productId: string;
  name: string;
  moduleCode: string | null;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  glbReady: boolean;
  processingStatus: string;
  linked: boolean;
};

export type SimilarKitchenVariant = {
  module: KitchenCatalogModule;
  variant: KitchenCatalogVariant;
  score: number;
};

type CabinetMatch = {
  catalogAdaptation?: "sink" | "hob" | "oven" | "hood";
  variantId?: string;
  partSelections?: Record<string, string>;
  type: "base" | "wall" | "tall";
  width: number;
  height: number;
  depth: number;
  opening?: KitchenOpening;
  corner?: boolean;
};

/** Validate saved assets again at render time, including legacy corner assignments. */
export function kitchenVariantMatchesRole(variant: KitchenCatalogVariant | undefined, cabinet: Pick<CabinetMatch, "type" | "corner" | "opening" | "catalogAdaptation">) {
  if (!variant) return false;
  if (variant.cabinetType && variant.cabinetType !== (cabinet.corner ? "corner" : cabinet.type)) return false;
  const adapted = "catalogAdaptation" in cabinet && cabinet.catalogAdaptation === cabinet.opening &&
    ((cabinet.type === "base" && ["sink", "hob", "oven"].includes(cabinet.opening ?? "")) || (cabinet.type === "wall" && cabinet.opening === "hood")) &&
    ["doors", "drawers", "open"].includes(variant.opening);
  if (variant.opening && variant.opening !== (cabinet.opening ?? "doors") && !adapted) return false;
  if (variant.mount && variant.mount !== (cabinet.corner ? "corner" : cabinet.type === "wall" ? "wall" : "floor") &&
    !(variant.mount === "floor-wall" && cabinet.type !== "wall")) return false;
  if (cabinet.corner && variant.nominalSizeMm && (variant.nominalSizeMm.depth <= 450) !== (cabinet.type === "wall")) return false;
  return true;
}

/** Catalog dimensions are a physical contract. Never stretch a different SKU. */
export function kitchenVariantFits(variant: KitchenCatalogVariant | undefined, cabinet: CabinetMatch) {
  if (!variant?.glbFile || variant.active === false || (variant.processingStatus && variant.processingStatus !== "ready")) return false;
  if (variant?.assetValidationIssues?.length) return false;
  if (!kitchenVariantMatchesRole(variant, cabinet)) return false;
  const size = variant?.nominalSizeMm;
  return !size || [size.width === cabinet.width, size.height === cabinet.height, size.depth === cabinet.depth].every(Boolean);
}

export function kitchenVariantFromModule(module: KitchenCatalogModule, variant: KitchenCatalogVariant): KitchenCatalogVariant {
  return { ...variant, cabinetType: module.cabinetType,
    mount: variant.mount ?? (module.cabinetType === "wall" ? "wall" : module.cabinetType === "corner" ? "corner" : "floor"),
    nominalSizeMm: { width: module.widthMm, height: module.heightMm, depth: module.depthMm } };
}

const readyVariant = (variant: KitchenCatalogVariant) => variant.active && Boolean(variant.glbFile) &&
  !variant.assetValidationIssues?.length && (!variant.processingStatus || variant.processingStatus === "ready");

export function matchingKitchenVariants(modules: KitchenCatalogModule[], cabinet: CabinetMatch) {
  const cabinetType = cabinet.corner ? "corner" : cabinet.type;
  return modules
    .filter((module) => module.active && module.cabinetType === cabinetType && module.widthMm === cabinet.width && module.heightMm === cabinet.height && module.depthMm === cabinet.depth)
    .flatMap((module) => module.variants.map(variant => kitchenVariantFromModule(module, variant)))
    .filter((variant) => readyVariant(variant) && kitchenVariantFits(variant, cabinet));
}

/** Nearby catalog products for the selected cabinet, ordered by compatibility. */
export function similarKitchenVariants(
  modules: KitchenCatalogModule[],
  cabinet: CabinetMatch,
  limit = 24,
): SimilarKitchenVariant[] {
  const cabinetType = cabinet.corner ? "corner" : cabinet.type;
  const opening = cabinet.opening ?? "doors";
  return modules
    .filter((module) => module.active && module.cabinetType === cabinetType &&
      (!cabinet.corner || (module.depthMm <= 450) === (cabinet.type === "wall")))
    .flatMap((module) => module.variants
      .filter((variant) => readyVariant(variant) && kitchenVariantMatchesRole(kitchenVariantFromModule(module, variant), { ...cabinet, opening: variant.opening }))
      .map((variant) => ({
        module,
        variant,
        score:
          (variant.opening === opening ? 0 : 10_000) +
          Math.abs(module.widthMm - cabinet.width) * 4 +
          Math.abs(module.heightMm - cabinet.height) * 2 +
          Math.abs(module.depthMm - cabinet.depth) * 2 +
          (variant.furnitureModelId === cabinet.variantId ? -20_000 : 0) +
          variant.sortOrder,
      })))
    .sort((a, b) => a.score - b.score || a.variant.modelName.localeCompare(b.variant.modelName))
    .slice(0, Math.max(0, limit));
}

/** Preserve a compatible SKU or select an exact published size. */
export function preferredKitchenVariant(modules: KitchenCatalogModule[], cabinet: CabinetMatch) {
  const exact = matchingKitchenVariants(modules, cabinet);
  if (cabinet.variantId && !modules.some(m => m.variants.some(v => v.furnitureModelId === cabinet.variantId))) return undefined;
  return exact.find(variant => variant.furnitureModelId === cabinet.variantId) ?? exact.find(variant => variant.isDefault) ?? exact[0];
}

export function applyKitchenCatalogVariants<
  T extends { cabinets: CabinetMatch[] },
>(kitchen: T, modules: KitchenCatalogModule[]): T {
  if (!modules.some((module) => module.variants.length)) return kitchen;
  let changed = false;
  const cabinets = kitchen.cabinets.map((cabinet) => {
    const preferred = preferredKitchenVariant(modules, cabinet);
    // A missing saved SKU stays identifiable and unavailable; never silently sell another SKU.
    if (!preferred && cabinet.variantId && !modules.some(m => m.variants.some(v => v.furnitureModelId === cabinet.variantId))) return cabinet;
    if (preferred?.furnitureModelId === cabinet.variantId) return cabinet;
    changed = true;
    const {
      variantId: _variantId,
      partSelections: _selections,
      ...withoutVariant
    } = cabinet;
    if (preferred)
      return { ...withoutVariant, variantId: preferred.furnitureModelId };
    return withoutVariant;
  });
  return changed ? { ...kitchen, cabinets } : kitchen;
}

export class KitchenModuleInputError extends Error {}
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseKitchenVariantInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new KitchenModuleInputError("Variant мэдээлэл буруу байна.");
  const raw = value as Record<string, unknown>;
  const modelId = typeof raw.modelId === "string" ? raw.modelId : "";
  const moduleId = typeof raw.moduleId === "string" ? raw.moduleId : "";
  const opening = typeof raw.opening === "string" ? raw.opening : "";
  const variantCode =
    typeof raw.variantCode === "string"
      ? raw.variantCode.trim().toUpperCase()
      : "";
  const designCode =
    typeof raw.designCode === "string"
      ? raw.designCode.trim().toUpperCase()
      : "";
  if (
    designCode &&
    !/^[A-Z0-9]{1,16}(?:-[A-Z0-9]{1,16}){0,3}$/.test(designCode)
  )
    throw new KitchenModuleInputError("Хийцийн code буруу байна.");
  const integer = (input: unknown, fallback: number) =>
    input === undefined ? fallback : Number(input);
  const doorCount = integer(raw.doorCount, 0),
    drawerCount = integer(raw.drawerCount, 0),
    sortOrder = integer(raw.sortOrder, 0);
  if (!UUID.test(modelId) || !UUID.test(moduleId))
    throw new KitchenModuleInputError("Model эсвэл module ID буруу байна.");
  if (!(KITCHEN_OPENINGS as readonly string[]).includes(opening))
    throw new KitchenModuleInputError("Нээлтийн төрөл буруу байна.");
  if (!/^[A-Z0-9][A-Z0-9_-]{1,79}$/.test(variantCode))
    throw new KitchenModuleInputError("Variant code 2–80 тэмдэгт байна.");
  if (
    ![doorCount, drawerCount, sortOrder].every(Number.isSafeInteger) ||
    doorCount < 0 ||
    doorCount > 2 ||
    drawerCount < 0 ||
    drawerCount > 4 ||
    sortOrder < 0 ||
    sortOrder > 10000
  ) {
    throw new KitchenModuleInputError(
      "Хаалга, шургуулга эсвэл эрэмбийн утга буруу байна.",
    );
  }
  const configuration: Record<string, unknown> = designCode
    ? { designCode }
    : {};
  if (raw.assemblyMode !== undefined) {
    if (raw.assemblyMode !== "parts" && raw.assemblyMode !== "authored")
      throw new KitchenModuleInputError("Угсралтын төрөл буруу байна.");
    configuration.assemblyMode = raw.assemblyMode;
  }
  if (raw.assembly !== undefined && raw.assembly !== null) {
    try {
      configuration.assembly = parseKitchenGlbAssembly(raw.assembly);
    } catch (error) {
      if (error instanceof KitchenAssemblyInputError)
        throw new KitchenModuleInputError(error.message);
      throw error;
    }
  }
  if (raw.assemblyMode === "parts") {
    const assembly = configuration.assembly as
      import("./kitchenGlbAssembly").KitchenGlbAssembly | undefined;
    if (
      (assembly?.slots.filter((slot) => slot.kind === "door").length ?? 0) !==
        doorCount ||
      (assembly?.slots.filter(
        (slot) => slot.kind === "drawer" || slot.kind === "drawer-front",
      ).length ?? 0) !== drawerCount
    )
      throw new KitchenModuleInputError(
        `${doorCount} хаалга, ${drawerCount} шургуулгын GLB-г тус бүр холбоно уу.`,
      );
    if (
      assembly?.slots.some(
        (slot) =>
          ["door", "drawer", "drawer-front"].includes(slot.kind) &&
          (slot.optional || !slot.defaultOptionId),
      )
    )
      throw new KitchenModuleInputError(
        "Хаалга, шургуулгын үндсэн GLB сонголт шаардлагатай.",
      );
  }
  return {
    modelId,
    moduleId,
    payload: {
      variantCode,
      opening,
      doorCount,
      drawerCount,
      isDefault: raw.isDefault === true,
      sortOrder,
      configuration,
    },
  };
}

export function parseVariantState(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new KitchenModuleInputError("Variant мэдээлэл буруу байна.");
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.modelId !== "string" ||
    !UUID.test(raw.modelId) ||
    typeof raw.active !== "boolean"
  )
    throw new KitchenModuleInputError("Variant төлөв буруу байна.");
  return { modelId: raw.modelId, active: raw.active };
}

export function parseKitchenModelDelete(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new KitchenModuleInputError("Устгах model-ийн мэдээлэл буруу байна.");
  const modelId =
    typeof (value as Record<string, unknown>).modelId === "string"
      ? ((value as Record<string, unknown>).modelId as string)
      : "";
  if (!UUID.test(modelId))
    throw new KitchenModuleInputError("Устгах model ID буруу байна.");
  return { modelId };
}
