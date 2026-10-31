import type { KitchenRoom, KitchenSpaceItem, ModularKitchen } from "./kitchenCabinets";
import { cabinetCorners, placementIssues } from "./kitchenPlacement";
import { parseKitchenSpace, spaceItemCandidates } from "./kitchenSpace";

type Wall = KitchenSpaceItem["wall"];
/** A cabinet this close to a wall (mm) counts as standing against it. */
const AGAINST_WALL = 700;

/**
 * One-tap window or door for a room that has none: the first spot, on the wall
 * with the fewest cabinets, that keeps the room valid and blocks no cabinet.
 * Null when every wall is full.
 */
export function addRoomOpening(kitchen: ModularKitchen, kind: "window" | "door", id: string): KitchenRoom | null {
  const { room } = kitchen;
  const load: Record<Wall, number> = { back: 0, front: 0, left: 0, right: 0 };
  for (const cabinet of kitchen.cabinets) {
    const corners = cabinetCorners(cabinet);
    const xs = corners.map((p) => p.x), zs = corners.map((p) => p.z);
    if (Math.min(...zs) < AGAINST_WALL) load.back++;
    if (Math.max(...zs) > room.depth - AGAINST_WALL) load.front++;
    if (Math.min(...xs) < AGAINST_WALL) load.left++;
    if (Math.max(...xs) > room.width - AGAINST_WALL) load.right++;
  }
  // Ties keep this order: a window reads best on the far wall, a door on the near one.
  const order: Wall[] = kind === "window" ? ["back", "left", "right", "front"] : ["front", "left", "right", "back"];
  const walls = order
    .filter((wall) => !(room.openFront && wall === "front"))
    .sort((a, b) => load[a] - load[b]);
  for (const wall of walls) {
    for (const item of spaceItemCandidates(room, kind, wall, id, kind === "window" ? 1400 : undefined)) {
      const next = { ...room, items: [...(room.items ?? []), item] };
      try {
        parseKitchenSpace(next);
      } catch {
        continue;
      }
      if (placementIssues({ ...kitchen, room: next }).some((issue) => issue.severity === "error")) continue;
      return next;
    }
  }
  return null;
}
