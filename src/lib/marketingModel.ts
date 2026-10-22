import type { Product } from "./types";

export type MarketingModel = {
  id: string;
  file: string;
  name: string;
  image: string;
  dimensions: { w: number; d: number; h: number };
  colors?: string[];
};

export function marketingProduct(
  product?: Product,
): MarketingModel | undefined {
  if (!product?.model) return undefined;
  return {
    id: product.model.id,
    file: product.model.previewFile || product.model.file,
    name: product.name,
    image: product.image,
    dimensions: product.dimensions,
    colors: product.colors
      ?.map((color) => color.hex)
      .filter((color) => /^#[0-9a-f]{6}$/i.test(color)),
  };
}
