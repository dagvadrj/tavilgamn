import type { PlacedFurniture, Product, RoomShape } from "./types";
import { normalizePlacementMetadata } from "./placementMetadata";
import { resolveFurnitureAttachments } from "./furnitureAttachment";
import { isPlacementValid, type PlacementRoom } from "@/three/collision";
import { hasAvailableStock } from "./inventory";

/** Replacements are atomic: retain instance and pose, then revalidate dependants. */
export function replaceRoomProduct(piece: PlacedFurniture, product: Product, pieces: PlacedFurniture[], room: RoomShape,
  roomId: string, context: { room: PlacementRoom; pieces: PlacedFurniture[] } = { room, pieces }): { pieces: PlacedFurniture[] | null; error: string | null } {
  if (piece.kitchen || !product.model || !hasAvailableStock(product))
    return { pieces: null, error: "Энэ бүтээгдэхүүний 3D загвар эсвэл нөөц бэлэн биш байна." };
  const kind = piece.attachment?.kind ?? "floor";
  const metadata = normalizePlacementMetadata(product.placement);
  if (!metadata.surfaces.includes(kind === "surface" ? "surface" : kind))
    return { pieces: null, error: "Шинэ бүтээгдэхүүний бэхэлгээ энэ байрлалд тохирохгүй байна." };
  const replacement: PlacedFurniture = {
    instanceId: piece.instanceId, productId: product.id, x: piece.x, z: piece.z, rotation: piece.rotation,
    elevation: piece.elevation, attachment: piece.attachment, placement: metadata,
    color: product.colors.some(c => c.id === piece.color) ? piece.color : product.defaultColor,
    material: product.materials.some(m => m.id === piece.material) ? piece.material : product.materials[0]?.id ?? "wood",
    details: { name: product.name, dimensions: { ...product.dimensions }, image: product.image, category: product.category },
  };
  try {
    const next = resolveFurnitureAttachments(pieces.map(p => p.instanceId === piece.instanceId ? replacement : p), room, roomId);
    const ownIds = new Set(pieces.map(p => p.instanceId));
    const all = [...context.pieces.filter(p => !ownIds.has(p.instanceId)), ...next];
    if (next.some(p => !isPlacementValid(p, all, context.room)))
      return { pieces: null, error: "Шинэ хэмжээ энэ байрлалд багтахгүй, нээлхий эсвэл тавилгатай давхцаж байна." };
    return { pieces: next, error: null };
  } catch (error) {
    return { pieces: null, error: error instanceof Error ? error.message : "Тавилгыг солих боломжгүй байна." };
  }
}
