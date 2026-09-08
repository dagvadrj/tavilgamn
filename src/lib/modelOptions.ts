import type { ColorOption, MaterialOption } from "./types";

export class ModelOptionsError extends Error {}

const MATERIAL_IDS = new Set(["wood", "metal", "fabric", "leather", "velvet"]);

function parseOptions(value: FormDataEntryValue | null): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = typeof value === "string" ? JSON.parse(value) : null;
  } catch {
    throw new ModelOptionsError("Өнгө, материалын JSON буруу байна");
  }

  if (
    !Array.isArray(parsed) ||
    parsed.length === 0 ||
    parsed.some((item) => !item || typeof item !== "object" || Array.isArray(item))
  ) {
    throw new ModelOptionsError("Өнгө болон материалын жагсаалт шаардлагатай");
  }

  const ids = new Set<string>();
  for (const item of parsed) {
    if (
      typeof item.id !== "string" || !item.id.trim() ||
      typeof item.name !== "string" || !item.name.trim() ||
      ids.has(item.id)
    ) {
      throw new ModelOptionsError("Өнгө, материалын нэр болон давхцаагүй ID шаардлагатай");
    }
    ids.add(item.id);
  }
  return parsed;
}

function validDelta(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseModelColors(value: FormDataEntryValue | null): ColorOption[] {
  return parseOptions(value).map((item) => {
    if (
      typeof item.hex !== "string" || !/^#[0-9a-f]{6}$/i.test(item.hex) ||
      (item.priceDelta !== undefined && !validDelta(item.priceDelta))
    ) {
      throw new ModelOptionsError("Өнгөний код эсвэл нэмэлт үнэ буруу байна");
    }
    return {
      id: item.id as string,
      name: item.name as string,
      hex: item.hex,
      priceDelta: item.priceDelta === undefined ? 0 : item.priceDelta as number,
    };
  });
}

export function parseModelMaterials(value: FormDataEntryValue | null): MaterialOption[] {
  return parseOptions(value).map((item) => {
    if (!MATERIAL_IDS.has(item.id as string) || !validDelta(item.priceDelta)) {
      throw new ModelOptionsError("Материалын төрөл эсвэл нэмэлт үнэ буруу байна");
    }
    return {
      id: item.id as MaterialOption["id"],
      name: item.name as string,
      priceDelta: item.priceDelta,
    };
  });
}
