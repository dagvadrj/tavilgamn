import type { Category, Product, RoomType } from "./types";
import { CATEGORY_LABEL } from "./catalogCategories";
import { catalogEligible } from "./roomCatalogPolicy";
import { hasAvailableStock } from "./inventory";

/**
 * Explicit pairings by category. These are furnishing conventions, not a style
 * or compatibility score: the reason text says exactly why a product is shown.
 */
const COMPLEMENTS: Partial<Record<Category, readonly Category[]>> = {
  sofa: ["coffee-table", "side-table", "armchair", "tv-stand", "bookshelf"],
  armchair: ["side-table", "coffee-table", "bookshelf", "sofa"],
  "coffee-table": ["sofa", "armchair", "tv-stand"],
  "side-table": ["sofa", "armchair", "bed"],
  "tv-stand": ["sofa", "armchair", "coffee-table"],
  bookshelf: ["armchair", "desk", "side-table"],
  bed: ["nightstand", "wardrobe", "dresser", "mattress", "bench"],
  mattress: ["bed", "nightstand"],
  nightstand: ["bed", "dresser"],
  wardrobe: ["dresser", "bed", "shoe-rack"],
  dresser: ["bed", "wardrobe", "nightstand"],
  "dining-table": ["chair", "bench", "storage-shelf"],
  chair: ["dining-table", "desk"],
  bench: ["dining-table", "shoe-rack"],
  desk: ["office-chair", "bookshelf", "storage-shelf"],
  "office-chair": ["desk"],
  office: ["office-chair", "bookshelf"],
  "shoe-rack": ["bench", "wardrobe"],
  "storage-shelf": ["desk", "dining-table"],
  "bathroom-cabinet": ["storage-shelf"],
};

export interface ComplementSuggestion {
  product: Product;
  reason: string;
}

/** Products from other categories that are customarily used with `product`. */
export function complementaryProducts(
  product: Pick<Product, "id" | "category">,
  products: Product[],
  options: { roomType: RoomType; storeId?: string; limit?: number },
): ComplementSuggestion[] {
  const order = COMPLEMENTS[product.category] ?? [];
  const source = CATEGORY_LABEL[product.category] ?? "Энэ бараа";
  return products
    .filter(
      (candidate) =>
        candidate.id !== product.id &&
        order.includes(candidate.category) &&
        !!candidate.model &&
        hasAvailableStock(candidate) &&
        catalogEligible(candidate, options.roomType, "room") &&
        (!options.storeId || candidate.storeIds?.includes(options.storeId)),
    )
    .sort(
      (a, b) =>
        order.indexOf(a.category) - order.indexOf(b.category) ||
        a.basePrice - b.basePrice ||
        a.name.localeCompare(b.name, "mn"),
    )
    .slice(0, options.limit ?? 12)
    .map((candidate) => ({
      product: candidate,
      reason: `${source}-тай хамт хэрэглэдэг: ${CATEGORY_LABEL[candidate.category].toLocaleLowerCase("mn")}`,
    }));
}

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Centres the toolbar over the selection, flips it below when there is no
 * room above, and keeps it inside the stage. Null when the selection is off
 * the stage entirely.
 */
export function placeSelectionToolbar(
  anchor: ScreenRect,
  stage: { width: number; height: number },
  bar: { width: number; height: number },
  { gap = 12, margin = 8 }: { gap?: number; margin?: number } = {},
): { x: number; y: number; side: "above" | "below" } | null {
  if (anchor.right < 0 || anchor.left > stage.width || anchor.bottom < 0 || anchor.top > stage.height) return null;
  const half = bar.width / 2;
  const centre = (Math.max(anchor.left, 0) + Math.min(anchor.right, stage.width)) / 2;
  const x = Math.min(Math.max(centre, margin + half), Math.max(margin + half, stage.width - margin - half));
  const above = anchor.top - gap - bar.height;
  if (above >= margin) return { x, y: above, side: "above" };
  const below = anchor.bottom + gap;
  if (below + bar.height <= stage.height - margin) return { x, y: below, side: "below" };
  return { x, y: margin, side: "above" };
}
