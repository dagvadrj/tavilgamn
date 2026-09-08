import type { Category, ColorOption, Material } from "./types";

export interface DbModelInfo {
  id: string;
  fileModelId?: string;
  name: string;
  category: Category;
  description: string;
  basePrice: number;
  glbFile: string;
  thumbnailFile: string;
  scale: number;
  dimensionsW: number;
  dimensionsD: number;
  dimensionsH: number;
  colors: ColorOption[];
  materials: { id: Material; name: string; priceDelta: number }[];
  inStock: boolean;
  stockQuantity?: number | null;
}

const registry = new Map<string, DbModelInfo>();

export function registerDbModel(info: DbModelInfo) {
  registry.set(info.id, info);
}

export function getDbModel(id: string): DbModelInfo | undefined {
  return registry.get(id);
}

export function getAllDbModels(): DbModelInfo[] {
  return Array.from(registry.values());
}
export function replaceDbModels(models: DbModelInfo[]) {
  registry.clear();

  for (const model of models) {
    registerDbModel(model);
  }
}