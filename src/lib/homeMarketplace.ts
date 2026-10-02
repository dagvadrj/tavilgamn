import type { Product, Store } from "./types";
import { priceFor } from "./products";

const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const marketplacePrice = (value: number) => `${money.format(value)}₮`;

/** Missing upload thumbnails are not promotional product photography. */
export function hasProductPhoto(product: Pick<Product, "image">): boolean {
  return Boolean(product.image?.trim()) && !/^\/(?:public\/)?(?:image\.png|placeholder(?:\.[a-z]+)?)(?:\?|$)/i.test(product.image);
}

export function defaultCartSelection(product: Product) {
  const color = product.colors?.find(option => option.id === product.defaultColor) ?? product.colors?.[0];
  const material = product.materials?.[0];
  if (!color || !material) return null;
  return { color, material, unitPrice: priceFor(product, color.id, material.id) };
}

export function storeCatalogStats(store: Pick<Store, "id">, products: Product[]) {
  const items = products.filter(product => product.storeIds?.includes(store.id));
  const reviewed = items.filter(product => product.reviewCount > 0 && Number.isFinite(product.rating) && product.rating > 0);
  const reviewCount = reviewed.reduce((total, product) => total + product.reviewCount, 0);
  return {
    productCount: items.length,
    reviewCount,
    // This is the weighted product rating, never an invented store review.
    rating: reviewCount ? reviewed.reduce((total, product) => total + product.rating * product.reviewCount, 0) / reviewCount : null,
  };
}

const DAY = 86_400_000;
const ULAANBAATAR_OFFSET = 8 * 3_600_000;
export function endOfMarketplaceDay(now: number): number {
  return (Math.floor((now + ULAANBAATAR_OFFSET) / DAY) + 1) * DAY - ULAANBAATAR_OFFSET;
}

export function marketplaceDayDigits(now: number): [string, string, string] {
  const seconds = Math.max(0, Math.floor((endOfMarketplaceDay(now) - now) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, "0")) as [string, string, string];
}
