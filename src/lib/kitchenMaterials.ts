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

const ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const COLOR = /^#[0-9a-f]{6}$/i;
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

/** Keep appliances, glass and hardware authored in the GLB; recolor cabinet surfaces. */
export function isKitchenMaterialTarget(meshName: string, materialName: string) {
  const name = `${meshName} ${materialName}`.toLocaleLowerCase();
  return !EXCLUDED_GLTF_SURFACES.some((token) => name.includes(token));
}
