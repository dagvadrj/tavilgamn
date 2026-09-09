import type { CartItem, Product } from "./types";

export const MAX_ITEM_QUANTITY = 99;
export const MAX_STOCK_QUANTITY = 1_000_000;

export function availableStock(product: Pick<Product, "stockQuantity">): number {
  return Number.isSafeInteger(product.stockQuantity) && (product.stockQuantity ?? -1) >= 0
    ? product.stockQuantity! : 0;
}

export function hasAvailableStock(product: Pick<Product, "stockQuantity">): boolean {
  return availableStock(product) > 0;
}

export function stockLabel(product: Pick<Product, "stockQuantity">): string {
  if (product.stockQuantity == null) return "Нөөцийн тоог баталгаажуулж байна";
  return availableStock(product) > 0 ? `Үлдэгдэл: ${product.stockQuantity} ширхэг` : "Нөөц дууссан · 0 ширхэг";
}

/** Stock is shared across all colors and materials of a product. */
export function quantityLimit(product: Pick<Product, "id" | "stockQuantity">, items: CartItem[], selection: Pick<CartItem, "color" | "material">, editingId?: string): number {
  const others = items.filter(item => item.productId === product.id && item.id !== editingId);
  const total = others.reduce((sum, item) => sum + item.qty, 0);
  const same = others.filter(item => item.color === selection.color && item.material === selection.material).reduce((sum, item) => sum + item.qty, 0);
  return Math.max(0, Math.min(MAX_ITEM_QUANTITY - same, availableStock(product) - total));
}
