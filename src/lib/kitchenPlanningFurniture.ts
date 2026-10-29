import type { ModularKitchen } from "./kitchenCabinets";
import type { KitchenExtra } from "./kitchenExtras";
import {
  cabinetCorners,
  cabinetsOverlap,
  placementIssues,
} from "./kitchenPlacement";
import { roomContainsFootprint } from "./kitchenRoomOutline";

export type KitchenPlanningFurnitureKind = "island" | "bar";
export const KITCHEN_PLANNING_FURNITURE = {
  island: { name: "Гал тогооны арал", width: 1600, depth: 900, height: 900 },
  bar: { name: "Тек", width: 1400, depth: 500, height: 1050 },
} as const;
export function validPlanningFurniture(
  kind: unknown,
  item: { width: number; depth: number; height: number },
) {
  return (
    (kind === "island" || kind === "bar") &&
    [item.width, item.depth, item.height].every(Number.isInteger) &&
    item.width >= 600 &&
    item.width <= 3000 &&
    item.depth >= (kind === "island" ? 600 : 350) &&
    item.depth <= 1400 &&
    item.height >= 750 &&
    item.height <= 1200
  );
}
/** Place the complete countertop footprint and preserve a 900mm working aisle at cabinets. */
export function placeKitchenPlanningFurniture(
  kitchen: ModularKitchen,
  kind: KitchenPlanningFurnitureKind,
  id: string,
  size: {
    width: number;
    depth: number;
    height: number;
  } = KITCHEN_PLANNING_FURNITURE[kind],
): KitchenExtra | null {
  if (
    !validPlanningFurniture(kind, size) ||
    (kitchen.extras?.length ?? 0) >= 40 ||
    size.height > kitchen.room.height
  )
    return null;
  const extra: KitchenExtra = {
    ...size,
    id,
    planningFurniture: kind,
    productId: `planning-${kind}`,
    name: KITCHEN_PLANNING_FURNITURE[kind].name,
    category: "dining-table",
    color: "#b99165",
    material: "wood",
    position: {
      x: kitchen.room.width / 2,
      z: kitchen.room.depth / 2,
      y: 0,
      rotation: 0,
    },
  };
  const candidates: KitchenExtra[] = [];
  for (const rotation of [0, Math.PI / 2]) {
    const halfX = (rotation ? size.depth : size.width) / 2,
      halfZ = (rotation ? size.width : size.depth) / 2;
    const xs = [kitchen.room.width / 2],
      zs = [kitchen.room.depth / 2];
    for (let x = halfX + 100; x <= kitchen.room.width - halfX - 100; x += 100)
      xs.push(x);
    for (let z = halfZ + 100; z <= kitchen.room.depth - halfZ - 100; z += 100)
      zs.push(z);
    for (const x of xs)
      for (const z of zs)
        candidates.push({ ...extra, position: { x, z, y: 0, rotation } });
  }
  candidates.sort(
    (a, b) =>
      Math.hypot(
        a.position.x - kitchen.room.width / 2,
        a.position.z - kitchen.room.depth / 2,
      ) -
      Math.hypot(
        b.position.x - kitchen.room.width / 2,
        b.position.z - kitchen.room.depth / 2,
      ),
  );
  for (const candidate of candidates) {
    if (!roomContainsFootprint(kitchen.room, cabinetCorners(candidate)))
      continue;
    const aisle = {
      ...candidate,
      width: candidate.width + 1800,
      depth: candidate.depth + 1800,
    };
    if (
      kitchen.cabinets.some(
        (c) => c.type !== "wall" && cabinetsOverlap(aisle, c),
      )
    )
      continue;
    if (
      placementIssues({
        ...kitchen,
        extras: [...(kitchen.extras ?? []), candidate],
      }).some((i) => i.severity === "error")
    )
      continue;
    return candidate;
  }
  return null;
}
