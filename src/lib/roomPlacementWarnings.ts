import type { PlacedFurniture, Product, RoomDesign } from "./types";
import { roomPosition } from "./roomLayout";
import { syncDesignRooms } from "./roomDesign";
import { furnitureOverlaps } from "@/three/collision";
import { getProduct } from "@/store/catalog";
import { getDbModel } from "./modelRegistry";

export type PlacementWarningItem = { id: string; roomId: string; name: string; roomName: string };
export type PlacementWarning = { id: string; items: [PlacementWarningItem, PlacementWarningItem] };

/** Compare world coordinates so open adjoining rooms share one deduplicated report. */
export function roomPlacementWarnings(design: RoomDesign, products: readonly Pick<Product, "id" | "name">[] = []): PlacementWarning[] {
  const rooms = syncDesignRooms(design).rooms ?? [];
  const entries = rooms.flatMap(room => {
    const origin = roomPosition(room);
    return room.pieces.map(piece => ({
      piece: { ...piece, x: piece.x + origin.x, z: piece.z + origin.z } as PlacedFurniture,
      item: {
        id: piece.instanceId,
        roomId: room.id,
        roomName: room.name,
        name: products.find(product => product.id === piece.productId)?.name ?? piece.kitchen?.name ?? piece.details?.name ?? getProduct(piece.productId)?.name
          ?? (piece.modelId ? getDbModel(piece.modelId)?.name : undefined) ?? "Тавилга",
      },
    }));
  });
  const warnings: PlacementWarning[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      if (furnitureOverlaps(a.piece, b.piece)) {
        warnings.push({ id: JSON.stringify([a.item.id, b.item.id].sort()), items: [a.item, b.item] });
      }
    }
  }
  return warnings;
}
