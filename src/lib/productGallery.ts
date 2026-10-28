import type { Product } from "./types";

/** Primary image first, then the extra gallery images, without blanks or repeats. */
export function productGallery(product: Pick<Product, "image" | "images">): string[] {
  return Array.from(
    new Set(
      [product.image, ...(product.images ?? [])].filter(
        (src): src is string => typeof src === "string" && src.trim() !== "",
      ),
    ),
  );
}
