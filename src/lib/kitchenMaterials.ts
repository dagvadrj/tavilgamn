export const KITCHEN_SURFACE_KINDS = [
  "general",
  "carcass",
  "front",
  "countertop",
  "handle",
  "appliance",
] as const;

export type KitchenSurfaceKind = (typeof KITCHEN_SURFACE_KINDS)[number];

export type KitchenMaterialDefinition = {
  id: string;
  name: string;
  surfaceKind: KitchenSurfaceKind;
  baseColor: string;
  roughness: number;
  metalness: number;
  texturePaths: Record<string, string>;
};

export type AdminKitchenMaterialDefinition = KitchenMaterialDefinition & {
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KitchenMaterialInput = KitchenMaterialDefinition;

export class KitchenMaterialInputError extends Error {}

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const TEXTURE_KEYS = ["baseColor", "normal", "roughness", "metalness"] as const;
const EXCLUDED_GLTF_SURFACES = [
  "appliance",
  "glass",
  "handle",
  "hinge",
  "hob",
  "hood",
  "metal",
  "oven",
  "refrigerator",
  "sink",
  "tap",
];

export function normalizeKitchenMaterials(value: unknown): KitchenMaterialDefinition[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: KitchenMaterialDefinition[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const raw = entry as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    const name = typeof raw.name === "string" ? raw.name.trim() : "";
    const surfaceKind = String(raw.surfaceKind ?? raw.surface_kind ?? "");
    const baseColor = String(raw.baseColor ?? raw.base_color ?? "");
    const roughness = Number(raw.roughness);
    const metalness = Number(raw.metalness);
    const paths = raw.texturePaths ?? raw.texture_paths;
    if (!ID.test(id) || seen.has(id) || !name || name.length > 120 ||
      !(KITCHEN_SURFACE_KINDS as readonly string[]).includes(surfaceKind) || !COLOR.test(baseColor) ||
      !Number.isFinite(roughness) || roughness < 0 || roughness > 1 ||
      !Number.isFinite(metalness) || metalness < 0 || metalness > 1 ||
      !paths || typeof paths !== "object" || Array.isArray(paths)) continue;
    const texturePaths = Object.fromEntries(Object.entries(paths as Record<string, unknown>)
      .filter((item): item is [string, string] => typeof item[1] === "string"));
    seen.add(id);
    result.push({ id, name, surfaceKind: surfaceKind as KitchenSurfaceKind, baseColor: baseColor.toUpperCase(), roughness, metalness, texturePaths });
  }
  return result;
}

export function normalizeAdminKitchenMaterials(value: unknown): AdminKitchenMaterialDefinition[] {
  if (!Array.isArray(value)) return [];
  const definitions = new Map(normalizeKitchenMaterials(value).map((item) => [item.id, item]));
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const raw = entry as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    const definition = definitions.get(id);
    const createdAt = String(raw.createdAt ?? raw.created_at ?? "");
    const updatedAt = String(raw.updatedAt ?? raw.updated_at ?? "");
    if (!definition || typeof raw.active !== "boolean" || !createdAt || !updatedAt) return [];
    return [{ ...definition, active: raw.active, createdAt, updatedAt }];
  });
}

function readTexturePaths(value: unknown) {
  if (value == null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new KitchenMaterialInputError("Texture мэдээлэл буруу байна.");
  const paths: Record<string, string> = {};
  for (const key of TEXTURE_KEYS) {
    const raw = (value as Record<string, unknown>)[key];
    if (raw == null || raw === "") continue;
    if (typeof raw !== "string") throw new KitchenMaterialInputError(`${key} texture-ийн зам буруу байна.`);
    const path = raw.trim();
    if (path.length > 2000 || (!path.startsWith("https://") && !path.startsWith("/") && !path.startsWith("http://localhost"))) {
      throw new KitchenMaterialInputError(`${key} texture нь HTTPS URL эсвэл /-ээр эхэлсэн дотоод зам байна.`);
    }
    paths[key] = path;
  }
  return paths;
}

export function parseKitchenMaterialInput(value: unknown): KitchenMaterialInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new KitchenMaterialInputError("Материалын мэдээлэл буруу байна.");
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim().toLowerCase() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const surfaceKind = String(raw.surfaceKind ?? "");
  const baseColor = String(raw.baseColor ?? "").toUpperCase();
  const roughness = Number(raw.roughness);
  const metalness = Number(raw.metalness);
  if (!ID.test(id)) throw new KitchenMaterialInputError("Код нь англи жижиг үсэг, тоо, _ эсвэл - тэмдэгтэй байна.");
  if (!name || name.length > 120) throw new KitchenMaterialInputError("Нэр 1–120 тэмдэгт байна.");
  if (!(KITCHEN_SURFACE_KINDS as readonly string[]).includes(surfaceKind)) throw new KitchenMaterialInputError("Материалын зориулалт буруу байна.");
  if (!COLOR.test(baseColor)) throw new KitchenMaterialInputError("Өнгө #RRGGBB хэлбэртэй байна.");
  if (!Number.isFinite(roughness) || roughness < 0 || roughness > 1) throw new KitchenMaterialInputError("Барзгар чанар 0–1 хооронд байна.");
  if (!Number.isFinite(metalness) || metalness < 0 || metalness > 1) throw new KitchenMaterialInputError("Металл чанар 0–1 хооронд байна.");
  return { id, name, surfaceKind: surfaceKind as KitchenSurfaceKind, baseColor, roughness, metalness, texturePaths: readTexturePaths(raw.texturePaths) };
}

export function parseKitchenMaterialState(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new KitchenMaterialInputError("Материалын төлөв буруу байна.");
  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim().toLowerCase() : "";
  if (!ID.test(id) || typeof raw.active !== "boolean") throw new KitchenMaterialInputError("Материалын код эсвэл төлөв буруу байна.");
  return { id, active: raw.active };
}

/** Keep appliances, glass and hardware authored in the GLB; recolor cabinet surfaces. */
export function isKitchenMaterialTarget(meshName: string, materialName: string) {
  const name = `${meshName} ${materialName}`.toLocaleLowerCase();
  return !EXCLUDED_GLTF_SURFACES.some((token) => name.includes(token));
}
