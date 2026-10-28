import type { RoomShape } from "@/lib/types";
import { getRoomGeometry } from "@/lib/roomGeometry";
import type { PlacementRoom } from "./collision";

export type DragPoint = readonly [number, number];

const distance = (a: DragPoint, b: DragPoint) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const along = (a: DragPoint, b: DragPoint, t: number): DragPoint => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/**
 * Furthest accepted point on the straight path. Sampling first means a column
 * or notch between the two points stops the path instead of being tunnelled.
 */
function furthest(from: DragPoint, to: DragPoint, accept: (point: DragPoint) => boolean, step: number): DragPoint {
  const length = distance(from, to);
  if (length < 1e-6) return from;
  // At most 12 cm between samples: less than any wall/column plus a footprint.
  const samples = Math.max(1, Math.ceil(length / Math.max(step, Math.min(0.12, length / 64))));
  let valid = 0;
  for (let i = 1; i <= samples; i++) {
    if (!accept(along(from, to, i / samples))) {
      let low = valid / samples, high = i / samples;
      for (let k = 0; k < 8; k++) {
        const middle = (low + high) / 2;
        if (accept(along(from, to, middle))) low = middle;
        else high = middle;
      }
      return along(from, to, low);
    }
    valid = i;
  }
  return to;
}

/**
 * Resolve a drag target that collision validation rejects: move to the contact
 * point, then continue the remaining motion along each permitted direction
 * (wall tangents, axes). Repeating lets a piece slide into a corner and out of it.
 * `from` must be an accepted point; the result is always an accepted point.
 */
export function solveDragPoint({ from, to, accept, directions, step = 0.04, iterations = 3 }: {
  from: DragPoint;
  to: DragPoint;
  accept: (point: DragPoint) => boolean;
  directions: DragPoint[];
  step?: number;
  iterations?: number;
}): DragPoint {
  if (!to.every(Number.isFinite)) return from;
  if (accept(to)) return to;
  if (!accept(from)) return from;
  let current = from;
  for (let i = 0; i < iterations; i++) {
    const remaining: DragPoint = [to[0] - current[0], to[1] - current[1]];
    if (Math.hypot(...remaining) < 1e-5) break;
    let best = furthest(current, to, accept, step);
    for (const [dx, dz] of directions) {
      const amount = remaining[0] * dx + remaining[1] * dz;
      if (Math.abs(amount) < 1e-5) continue;
      const option = furthest(current, [current[0] + dx * amount, current[1] + dz * amount], accept, step);
      if (distance(option, to) < distance(best, to)) best = option;
    }
    if (distance(best, to) >= distance(current, to) - 1e-6) break;
    current = best;
  }
  return current;
}

/** Points beyond the placement bounds can never be valid; clamping keeps searches short. */
export function clampDragPoint(point: DragPoint, bounds: { minX: number; maxX: number; minZ: number; maxZ: number }, margin = 0.5): DragPoint {
  return [
    Math.max(bounds.minX - margin, Math.min(bounds.maxX + margin, point[0])),
    Math.max(bounds.minZ - margin, Math.min(bounds.maxZ + margin, point[1])),
  ];
}

/** Floor sliding directions: both axes plus every nearby wall's tangent, deduplicated. */
export function floorSlideDirections(room: PlacementRoom | RoomShape, near: DragPoint, reach = 2.5): DragPoint[] {
  const directions: DragPoint[] = [[1, 0], [0, 1]];
  let segments;
  try {
    segments = ("placementGeometry" in room && room.placementGeometry ? room.placementGeometry : getRoomGeometry(room)).segments;
  } catch {
    return directions;
  }
  for (const { a, b } of segments) {
    const dx = b.x - a.x, dz = b.z - a.z, length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((near[0] - a.x) * dx + (near[1] - a.z) * dz) / (length * length)));
    if (Math.hypot(near[0] - a.x - dx * t, near[1] - a.z - dz * t) > reach) continue;
    const direction: DragPoint = [dx / length, dz / length];
    if (directions.every(([x, z]) => Math.abs(x * direction[1] - z * direction[0]) > 1e-3)) directions.push(direction);
  }
  return directions;
}
