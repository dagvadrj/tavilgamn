import type { Product } from "./types";

export interface ProductOffer {
  compareAtPrice: number | null;
  discountPercent: number | null;
  label: string | null;
}

/** Only authored, unexpired promotion metadata may become a customer-facing offer. */
export function productOffer(product: Pick<Product, "basePrice" | "compareAtPrice" | "promotionLabel" | "promotionEndsAt">, now?: number): ProductOffer {
  const expires = product.promotionEndsAt ? Date.parse(product.promotionEndsAt) : null;
  const active = expires === null || (Number.isFinite(expires) && now !== undefined && expires > now);
  const compareAtPrice = active && Number.isFinite(product.compareAtPrice) && (product.compareAtPrice ?? 0) > product.basePrice
    ? product.compareAtPrice! : null;
  const discountPercent = compareAtPrice !== null ? Math.floor((compareAtPrice - product.basePrice) * 100 / compareAtPrice) : null;
  return {
    compareAtPrice,
    discountPercent: discountPercent !== null && discountPercent > 0 ? discountPercent : null,
    label: active && product.promotionLabel?.trim() ? product.promotionLabel.trim() : null,
  };
}

export function hasProductOffer(product: Pick<Product, "basePrice" | "compareAtPrice" | "promotionLabel" | "promotionEndsAt">, now: number): boolean {
  const offer = productOffer(product, now);
  return offer.compareAtPrice !== null || offer.label !== null;
}
