import type { DesignRoom, PlacedFurniture, RoomDesign } from "@/lib/types";
import { activateDesignRoom, syncDesignRooms } from "@/lib/roomDesign";
import { getRoomGeometry, type Bounds } from "@/lib/roomGeometry";
import { roomPosition } from "@/lib/roomLayout";
import { isPlacementValid } from "./collision";
import { roomPlacementContext } from "./roomPlacement";

const EPS = 1e-6;
const inBounds = (x: number, z: number, b: Bounds) => x > b.minX + EPS && x < b.maxX - EPS && z > b.minZ + EPS && z < b.maxZ - EPS;

function containsCentre(room: DesignRoom, x: number, z: number) {
  const geometry = getRoomGeometry(room), origin = roomPosition(room);
  const localX = x - origin.x, localZ = z - origin.z;
  return geometry.connected && geometry.simple && inBounds(localX, localZ, geometry.bounds)
    && !geometry.voids.some(voidBounds => localX >= voidBounds.minX - EPS && localX <= voidBounds.maxX + EPS && localZ >= voidBounds.minZ - EPS && localZ <= voidBounds.maxZ + EPS);
}

/** Keep world position unchanged when a released piece becomes another room's furniture. */
export function reassignFurnitureRooms(design: RoomDesign, followPieceId?: string): RoomDesign {
  const synced = syncDesignRooms(design), rooms = synced.rooms!;
  const transfers = new Map<string, { owner: string; piece: PlacedFurniture }>();
  for (const source of rooms) for (const piece of source.pieces) {
    const from = roomPosition(source), worldX = piece.x + from.x, worldZ = piece.z + from.z;
    // A centre exactly on the shared boundary keeps its current owner.
    const target = rooms.find(room => room.id !== source.id && containsCentre(room, worldX, worldZ));
    if (!target || containsCentre(source, worldX, worldZ)) continue;
    const to = roomPosition(target), translated = { ...piece, x: worldX - to.x, z: worldZ - to.z };
    const context = roomPlacementContext(synced, target.id);
    if (!isPlacementValid(translated, context.pieces, context.room)) continue;
    transfers.set(piece.instanceId, { owner: target.id, piece: translated });
  }
  if (!transfers.size) return synced;
  const nextRooms = rooms.map(room => ({ ...room, pieces: [
    ...room.pieces.filter(piece => !transfers.has(piece.instanceId)),
    ...[...transfers.values()].filter(transfer => transfer.owner === room.id).map(transfer => transfer.piece),
  ] }));
  // Refresh the flattened active-room cache before any synchronisation can overwrite it.
  const activePieces = nextRooms.find(room => room.id === synced.activeRoomId)!.pieces;
  const next = { ...synced, rooms: nextRooms, pieces: activePieces };
  return activateDesignRoom(next, (followPieceId && transfers.get(followPieceId)?.owner) || synced.activeRoomId!);
}

/** The last changed/new piece is the one to keep selected after a committed move. */
export function movedFurnitureId(before: PlacedFurniture[], after: PlacedFurniture[]): string | undefined {
  for (let index = after.length - 1; index >= 0; index--) {
    const piece = after[index], previous = before.find(item => item.instanceId === piece.instanceId);
    if (!previous || piece.x !== previous.x || piece.z !== previous.z) return piece.instanceId;
  }
  return undefined;
}
