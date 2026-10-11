import type {
  Category,
  PlacedFurniture,
  Product,
  RoomShape,
  RoomType,
  SavedFurniture,
} from "./types";
import { findFreePlacement, isPlacementValid } from "@/three/collision";

export type FurnishingMode = "empty" | "preset" | "mine";
export interface FurnishingOptions {
  furnishing?: FurnishingMode;
  furnitureIds?: string[];
}
const categories: Record<RoomType, Category[]> = {
  living: ["sofa", "coffee-table", "tv-stand", "armchair"],
  bedroom: ["bed", "wardrobe", "side-table"],
  office: ["desk", "office-chair", "bookshelf", "office"],
  kitchen: ["kitchen-cabinet", "dining-table", "chair"],
  bathroom: ["bathroom-cabinet", "storage-shelf"],
  other: ["armchair", "side-table"],
};
export function suggestedFurniture(
  type: RoomType,
  products: Product[],
  pieces: PlacedFurniture[] = [],
) {
  const used = new Set(pieces.map((p) => p.productId));
  return categories[type].flatMap((category) => {
    const product = products.find(
      (p) =>
        p.category === category &&
        p.model &&
        p.inStock &&
        p.stockQuantity !== 0 &&
        !used.has(p.id),
    );
    return product ? [product] : [];
  });
}
export function productPiece(product: Product): PlacedFurniture {
  return {
    instanceId: `p_${crypto.randomUUID()}`,
    productId: product.id,
    x: 0,
    z: 0,
    rotation: 0,
    color: product.defaultColor,
    material: product.materials[0]?.id ?? "wood",
    details: {
      name: product.name,
      dimensions: { ...product.dimensions },
      image: product.image,
      category: product.category,
    },
  };
}
/** Preserve real dimensions. A piece that does not fit remains in the user's library. */
export function furnishRoom(
  room: RoomShape,
  type: RoomType,
  options: FurnishingOptions,
  products: Product[],
  library: SavedFurniture[],
) {
  const candidates =
    options.furnishing === "preset"
      ? suggestedFurniture(type, products).map(productPiece)
      : options.furnishing === "mine"
        ? library
            .filter((item) => options.furnitureIds?.includes(item.id))
            .flatMap((item) =>
              Array.from(
                { length: Math.min(20, Math.max(1, item.quantity)) },
                () => ({
                  ...item.piece,
                  instanceId: `p_${crypto.randomUUID()}`,
                  x: 0,
                  z: 0,
                  details: {
                    ...item.piece.details,
                    name: item.name,
                    dimensions: { ...item.dimensions },
                    image: item.image,
                  },
                }),
              ),
            )
        : [];
  const pieces: PlacedFurniture[] = [],
    skipped: string[] = [];
  for (const piece of candidates) {
    // Large pieces first try a perimeter, leaving the centre free for circulation.
    let placed: PlacedFurniture | null = null;
    for (const rotation of [piece.rotation, piece.rotation + Math.PI / 2]) {
      const size = piece.details?.dimensions;
      if (size) {
        const depth =
          Math.abs(Math.sin(rotation)) * size.w +
          Math.abs(Math.cos(rotation)) * size.d;
        const nearWall = {
          ...piece,
          rotation,
          z: -room.depth / 2 + depth / 2 + 0.08,
        };
        if (isPlacementValid(nearWall, pieces, room)) placed = nearWall;
      }
      placed ??= findFreePlacement({ ...piece, rotation }, pieces, room);
      if (placed) break;
    }
    if (placed) pieces.push(placed);
    else skipped.push(piece.details?.name ?? piece.productId);
  }
  return {
    pieces,
    skipped,
    suggestions: suggestedFurniture(type, products, pieces),
  };
}
