import type { KitchenRoom, KitchenSpaceItem } from "./kitchenCabinets";

type Vec3 = [number, number, number];

const OUTWARD: Record<KitchenSpaceItem["wall"], [number, number]> = {
  back: [0, -1],
  right: [1, 0],
  front: [0, 1],
  left: [-1, 0],
};

/** Sun height and sideways skew: a low, slanted beam like a late-morning window. */
const SUN_ELEVATION = (36 * Math.PI) / 180;
const SUN_SKEW = (28 * Math.PI) / 180;
const SUN_DISTANCE = 9;

export interface KitchenDaylight {
  /** World metres. */
  position: Vec3;
  target: Vec3;
  /** Horizontal unit vector from the room centre to where the camera opens. */
  cameraSide: [number, number];
  windowId: string | null;
}

const rotate = ([x, z]: [number, number], angle: number): [number, number] => [
  x * Math.cos(angle) - z * Math.sin(angle),
  x * Math.sin(angle) + z * Math.cos(angle),
];

/**
 * One sun that actually passes through the room's widest window, so its
 * frame and mullion draw a patch on the floor. Without a window the sun keeps
 * the previous high front-right angle. The default camera opens on the side
 * facing that window, keeping the window wall (and its light) in view.
 */
export function kitchenDaylight(room: Pick<KitchenRoom, "width" | "depth" | "height" | "items">): KitchenDaylight {
  const width = room.width / 1000;
  const depth = room.depth / 1000;
  const height = room.height / 1000;
  const window = (room.items ?? [])
    .filter((item) => item.kind === "window")
    .sort((a, b) => b.width - a.width)[0];
  if (!window)
    return {
      position: [width / 2 + 3, height + 5, depth / 2 + 4],
      target: [width / 2, height / 3, depth / 2],
      cameraSide: normalise([0.5, 1]),
      windowId: null,
    };
  const outward = OUTWARD[window.wall];
  const sill = (window.sillHeight ?? 900) / 1000;
  const top = sill + (window.height ?? 1100) / 1000;
  const centre: Vec3 = [window.x / 1000, (sill + top) / 2, window.z / 1000];
  const [sx, sz] = rotate(outward, SUN_SKEW);
  const flat = Math.cos(SUN_ELEVATION) * SUN_DISTANCE;
  return {
    position: [centre[0] + sx * flat, centre[1] + Math.sin(SUN_ELEVATION) * SUN_DISTANCE, centre[2] + sz * flat],
    target: centre,
    // Stand opposite the window, a little to one side, as in a corner view.
    cameraSide: normalise(rotate([-outward[0], -outward[1]], -0.6)),
    windowId: window.id,
  };
}

function normalise([x, z]: [number, number]): [number, number] {
  const length = Math.hypot(x, z) || 1;
  return [x / length, z / length];
}
