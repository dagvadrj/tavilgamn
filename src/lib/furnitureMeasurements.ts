import type { PlacedFurniture, RoomShape } from "./types";
import { getRoomGeometry, type Point, type RoomSegment } from "./roomGeometry";

export type MeasurementPoint = [number, number, number];
export type FurnitureDimensions = { w: number; d: number; h: number };
export type Measurement = {
  id: string; label: string; value: number;
  from: MeasurementPoint; to: MeasurementPoint;
  kind: "size" | "gap"; vertical?: boolean;
};
const EPS = 1e-7;
export const formatMeasurement = (metres: number) => `${Math.round(metres * 1000) / 10} см`;

/** Clip the footprint to a finite wall's span, rather than using its infinite plane. */
function clip(points: Point[], axis: "x" | "z", bound: number, sign: number): Point[] {
  const result: Point[] = [];
  points.forEach((a, index) => {
    const b = points[(index + 1) % points.length];
    const da = (a[axis] - bound) * sign, db = (b[axis] - bound) * sign;
    if (da >= -EPS) result.push(a);
    if ((da >= -EPS) !== (db >= -EPS)) {
      const t = da / (da - db);
      result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  });
  return result;
}

function isColumnFace(room: RoomShape, wall: RoomSegment) {
  return wall.hole || (room.columns ?? []).some(column => {
    const x = column.x - room.width / 2, z = column.z - room.depth / 2;
    return wall.nx !== 0
      ? (Math.abs(wall.a.x - x) < EPS || Math.abs(wall.a.x - x - column.width) < EPS) &&
        Math.min(wall.a.z, wall.b.z) >= z - EPS && Math.max(wall.a.z, wall.b.z) <= z + column.depth + EPS
      : (Math.abs(wall.a.z - z) < EPS || Math.abs(wall.a.z - z - column.depth) < EPS) &&
        Math.min(wall.a.x, wall.b.x) >= x - EPS && Math.max(wall.a.x, wall.b.x) <= x + column.width + EPS;
  });
}

/** All coordinates and lengths are metres, in the same world frame as Three.js. */
export function getFurnitureMeasurements(room: RoomShape, piece: PlacedFurniture, dims: FurnitureDimensions): Measurement[] {
  if (![piece.x, piece.z, piece.rotation, dims.w, dims.d, dims.h].every(Number.isFinite) ||
      dims.w <= 0 || dims.d <= 0 || dims.h <= 0) return [];
  const cos = Math.cos(piece.rotation), sin = Math.sin(piece.rotation);
  const world = (x: number, y: number, z: number): MeasurementPoint =>
    [piece.x + x * cos + z * sin, y, piece.z - x * sin + z * cos];
  const w = dims.w / 2, d = dims.d / 2, y = 0.06, offset = 0.22;
  const footprint = [[-w, -d], [w, -d], [w, d], [-w, d]].map(([x, z]) => {
    const point = world(x, 0, z);
    return { x: point[0], z: point[2] };
  });
  const lines: Measurement[] = [
    { id: "width", label: "Өргөн", value: dims.w, from: world(-w, y, d + offset), to: world(w, y, d + offset), kind: "size" },
    { id: "depth", label: "Урт / гүн", value: dims.d, from: world(w + offset, y, -d), to: world(w + offset, y, d), kind: "size" },
    { id: "height", label: "Өндөр", value: dims.h, from: world(-w - offset, 0, d + offset), to: world(-w - offset, dims.h, d + offset), kind: "size", vertical: true },
    { id: "ceiling", label: "Тааз хүртэл", value: (room.height ?? 2.7) - dims.h,
      from: world(0, dims.h, 0), to: world(0, room.height ?? 2.7, 0), kind: "gap", vertical: true },
  ];
  const walls = getRoomGeometry(room).segments;
  for (const direction of [
    { id: "west", label: "Зүүн", nx: 1, nz: 0 }, { id: "east", label: "Баруун", nx: -1, nz: 0 },
    { id: "north", label: "Арын", nx: 0, nz: 1 }, { id: "south", label: "Урд", nx: 0, nz: -1 },
  ]) {
    let nearest: Measurement | undefined;
    for (const wall of walls) {
      if (wall.nx !== direction.nx || wall.nz !== direction.nz) continue;
      const axis = wall.nx ? "z" : "x";
      const polygon = clip(clip(footprint, axis, Math.min(wall.a[axis], wall.b[axis]), 1), axis, Math.max(wall.a[axis], wall.b[axis]), -1);
      if (!polygon.length) continue;
      const distances = polygon.map(p => (p.x - wall.a.x) * wall.nx + (p.z - wall.a.z) * wall.nz);
      const distance = Math.min(...distances);
      if (distance < -EPS || (nearest && distance >= nearest.value - EPS)) continue;
      // Average a parallel closest edge; for rotated furniture this is its closest corner.
      const closest = polygon.filter((_, i) => Math.abs(distances[i] - distance) < EPS);
      const start = closest.reduce((sum, p) => ({ x: sum.x + p.x / closest.length, z: sum.z + p.z / closest.length }), { x: 0, z: 0 });
      const value = Math.max(0, distance);
      nearest = { id: direction.id, label: `${direction.label} ${isColumnFace(room, wall) ? "багана" : "хана"}`, value,
        from: [start.x, Math.min(dims.h / 2, 0.5), start.z],
        to: [start.x - wall.nx * value, Math.min(dims.h / 2, 0.5), start.z - wall.nz * value], kind: "gap" };
    }
    if (nearest) lines.push(nearest);
  }
  return lines;
}
