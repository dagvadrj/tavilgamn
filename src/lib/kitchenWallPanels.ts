import type { KitchenRoom, KitchenWall } from "./kitchenCabinets";
import { onRoomSegment } from "./kitchenRoomOutline";

export function kitchenWallPanels(wall: KitchenWall, room: KitchenRoom) {
  const height = room.height / 1000;
  const cx = (wall.start.x + wall.end.x) / 2000,
    cz = (wall.start.z + wall.end.z) / 2000;
  const length =
    Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) / 1000;
  const angle = Math.atan2(wall.inward.x, wall.inward.z);
  const openings = (room.items ?? [])
    .filter(
      (i) =>
        i.wall === (wall.sourceWall ?? wall.id) &&
        ["door", "window"].includes(i.kind) &&
        (!room.outline || onRoomSegment(i, wall.start, wall.end)),
    )
    .map((i) => ({
      id: i.id,
      kind: i.kind,
      width: i.width / 1000,
      x:
        (i.x / 1000 - cx) * Math.cos(angle) -
        (i.z / 1000 - cz) * Math.sin(angle),
      bottom: i.kind === "door" ? 0 : (i.sillHeight ?? 900) / 1000,
      top: i.height === undefined ? Math.min(i.kind === "door" ? 2.1 : 2, height - 0.1) :
        ((i.kind === "door" ? 0 : i.sillHeight ?? 900) + i.height) / 1000,
    }))
    .sort((a, b) => a.x - b.x);
  const solids: { x: number; y: number; width: number; height: number }[] = [];
  const add = (left: number, right: number, bottom: number, top: number) => {
    if (right - left > 0.0001 && top - bottom > 0.0001)
      solids.push({
        x: (left + right) / 2,
        y: (top + bottom) / 2,
        width: right - left,
        height: top - bottom,
      });
  };
  let left = -length / 2;
  for (const opening of openings) {
    const start = opening.x - opening.width / 2,
      end = opening.x + opening.width / 2;
    add(left, start, 0, height);
    add(start, end, 0, opening.bottom);
    add(start, end, opening.top, height);
    left = end;
  }
  add(left, length / 2, 0, height);
  return { solids, openings };
}
