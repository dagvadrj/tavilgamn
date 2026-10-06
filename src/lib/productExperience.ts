import type { Product } from "./types";

export function installmentAmounts(total: number, count = 4): number[] {
  if (!Number.isFinite(total) || total < 0 || !Number.isInteger(count) || count < 2 || count > 12) return [];
  const rounded = Math.round(total), base = Math.floor(rounded / count), remainder = rounded % count;
  return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
}

/** Both the human and furniture use this single metres-to-pixels conversion. */
export function productScaleLayout(dimensions: Product["dimensions"]) {
  const width = 520, height = 230, floor = 196, humanHeight = 1.7;
  const pxPerMetre = Math.min(160 / Math.max(humanHeight, dimensions.h), 320 / dimensions.w);
  return { width, height, floor, pxPerMetre,
    product: { x: 42, y: floor - dimensions.h * pxPerMetre, width: dimensions.w * pxPerMetre, height: dimensions.h * pxPerMetre },
    human: { x: 428, y: floor - humanHeight * pxPerMetre, height: humanHeight * pxPerMetre },
  };
}
