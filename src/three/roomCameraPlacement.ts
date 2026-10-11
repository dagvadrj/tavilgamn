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

export type TourPoint = { x: number; z: number };
type TourRoom = RoomShape & { pieces: PlacedFurniture[] };

/** Validate the whole route, including narrow columns and rotated furniture. */
export function tourRouteClear(room: TourRoom, from: TourPoint, to: TourPoint) {
  if (!tourPointValid(room, to.x, to.z)) return false;
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.05),
  );
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (
      !tourPointValid(
        room,
        from.x + (to.x - from.x) * t,
        from.z + (to.z - from.z) * t,
      )
    )
      return false;
  }
  return true;
}

/** A fixed room grid supplies nearby viewpoints, rather than a walking loop. */
export function tourStepTargets(room: TourRoom, from: TourPoint): TourPoint[] {
  const sectors = new Map<number, { point: TourPoint; score: number }>();
  const gx = Math.round(from.x / 0.8),
    gz = Math.round(from.z / 0.8);
  for (let ix = gx - 3; ix <= gx + 3; ix++) {
    for (let iz = gz - 3; iz <= gz + 3; iz++) {
      const point = { x: ix * 0.8, z: iz * 0.8 };
      const dx = point.x - from.x,
        dz = point.z - from.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.55 || distance > 2.4) continue;
      const angle = Math.atan2(dx, -dz);
      const sector = Math.round(angle / (Math.PI / 2));
      const key = (sector + 4) % 4;
      const score =
        Math.abs(distance - 1.6) + Math.abs(angle - (sector * Math.PI) / 2);
      if (score >= (sectors.get(key)?.score ?? Infinity)) continue;
      if (tourRouteClear(room, from, point)) sectors.set(key, { point, score });
    }
  }
  return [...sectors.values()].map(({ point }) => point);
}
