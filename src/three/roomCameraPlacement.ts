import type { PlacedFurniture, RoomShape } from "@/lib/types";
import { cameraPointValid, interiorCamera } from "@/lib/roomInteriorCamera";
import { pieceRects } from "./collision";

export function cameraFurnitureClear(
  pieces: PlacedFurniture[],
  x: number,
  z: number,
): boolean {
  return pieces.every((piece) =>
    pieceRects(piece).every((rect) => {
      const dx = x - rect.cx,
        dz = z - rect.cz;
      const localX = dx * Math.cos(rect.rot) + dz * Math.sin(rect.rot);
      const localZ = -dx * Math.sin(rect.rot) + dz * Math.cos(rect.rot);
      return (
        Math.abs(localX) > rect.w / 2 + 0.12 ||
        Math.abs(localZ) > rect.d / 2 + 0.12
      );
    }),
  );
}
export function roomTourCamera(
  room: RoomShape & { pieces: PlacedFurniture[] },
) {
  return interiorCamera(room, (x, z) =>
    cameraFurnitureClear(room.pieces, x, z),
  );
}
export function tourPointValid(
  room: RoomShape & { pieces: PlacedFurniture[] },
  x: number,
  z: number,
) {
  return (
    cameraPointValid(room, x, z) && cameraFurnitureClear(room.pieces, x, z)
  );
}
