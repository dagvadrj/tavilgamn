import type { Product } from "./types";
export { CATEGORIES, CATEGORY_LABEL } from "./catalogCategories";

export function priceFor(
  product: Product,
  colorId: string,
  materialId: string,
): number {
  const c = product.colors.find((x) => x.id === colorId);
  const m = product.materials.find((x) => x.id === materialId);
  return product.basePrice + (c?.priceDelta ?? 0) + (m?.priceDelta ?? 0);
}
