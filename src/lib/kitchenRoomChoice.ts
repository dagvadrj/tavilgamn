import type { CabinetPose, KitchenRoom, ModularKitchen } from "./kitchenCabinets";

/** Outer size a ready-made kitchen needs, in millimetres. */
export type KitchenFootprint = { widthMm: number; depthMm: number; heightMm: number };

export type KitchenRoomFitResult = { fits: boolean; message: string };

/** Mm a wall-anchored run may sit away from the wall and still count as touching it. */
const WALL_TOUCH = 60;

/**
 * Whether a design fits a room as it is drawn (no rotation): the planner keeps
 * the merchant's layout, so the room must be at least the kitchen's outer box.
 */
export function kitchenRoomFit(need: KitchenFootprint, room: Pick<KitchenRoom, "width" | "depth" | "height">): KitchenRoomFitResult {
  const short = [
    need.widthMm > room.width ? `өргөн ${need.widthMm - room.width} мм` : "",
    need.depthMm > room.depth ? `урт ${need.depthMm - room.depth} мм` : "",
    need.heightMm > room.height ? `өндөр ${need.heightMm - room.height} мм` : "",
  ].filter(Boolean);
  return short.length
    ? { fits: false, message: `Багтахгүй: ${short.join(", ")} дутна` }
    : { fits: true, message: "Хэмжээнд багтана" };
}

/** Floor box the cabinets cover, honouring quarter-turn rotations. */
export function kitchenCabinetBounds(kitchen: ModularKitchen) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0;
  for (const cabinet of kitchen.cabinets) {
    const turned = Math.abs(Math.sin(cabinet.position.rotation)) > 0.5;
    const halfX = (turned ? cabinet.depth : cabinet.width) / 2;
    const halfZ = (turned ? cabinet.width : cabinet.depth) / 2;
    minX = Math.min(minX, cabinet.position.x - halfX);
    maxX = Math.max(maxX, cabinet.position.x + halfX);
    minZ = Math.min(minZ, cabinet.position.z - halfZ);
    maxZ = Math.max(maxZ, cabinet.position.z + halfZ);
    // Ceiling-fitted tall units follow the room height, so they never decide it.
    if (!cabinet.fitToCeiling) maxY = Math.max(maxY, cabinet.position.y + cabinet.height);
  }
  return { minX, maxX, minZ, maxZ, maxY };
}

/**
 * Moves a design into the buyer's room. Runs that hug the right or front wall
 * keep hugging it; everything else stays anchored to the back-left corner.
 * Returns null when the cabinets cannot fit the room.
 */
export function placeKitchenInRoom(design: ModularKitchen, room: KitchenRoom): ModularKitchen | null {
  if (!design.cabinets.length) return null;
  const old = design.room;
  const box = kitchenCabinetBounds(design);
  const hugs = (near: number, far: number, size: number) => far >= size - WALL_TOUCH && near > WALL_TOUCH;
  const dx = hugs(box.minX, box.maxX, old.width) ? room.width - old.width : 0;
  const dz = hugs(box.minZ, box.maxZ, old.depth) ? room.depth - old.depth : 0;
  if (
    box.minX + dx < -1 || box.maxX + dx > room.width + 1 ||
    box.minZ + dz < -1 || box.maxZ + dz > room.depth + 1 ||
    box.maxY > room.height + 1
  )
    return null;
  const move = <T extends { position: CabinetPose }>(item: T): T => ({
    ...item,
    position: { ...item.position, x: item.position.x + dx, z: item.position.z + dz },
  });
  return {
    ...design,
    room: JSON.parse(JSON.stringify(room)) as KitchenRoom,
    cabinets: design.cabinets.map((cabinet) =>
      move(cabinet.fitToCeiling ? { ...cabinet, height: room.height - cabinet.position.y } : cabinet),
    ),
    extras: design.extras?.map(move),
    countertopLayout: design.countertopLayout && {
      ...design.countertopLayout,
      panels: design.countertopLayout.panels.map((panel) => ({
        ...move(panel),
        ...(panel.cutoutAnchor
          ? { cutoutAnchor: { ...panel.cutoutAnchor, x: panel.cutoutAnchor.x + dx, z: panel.cutoutAnchor.z + dz } }
          : {}),
      })),
    },
    backsplashSettings: design.backsplashSettings && {
      ...design.backsplashSettings,
      panels: design.backsplashSettings.panels.map(move),
    },
  };
}
