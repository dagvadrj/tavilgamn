import type { PlacedFurniture, RoomShape } from "@/lib/types";
import { getRoomGeometry } from "@/lib/roomGeometry";
import { getProduct } from "@/store/catalog";
import { getDbModel } from "@/lib/modelRegistry";

interface Rect {
  cx: number;
  cz: number;
  w: number;
  d: number;
  rot: number;
}

export const dimsFor = (piece: PlacedFurniture) => {
  if (piece.modelId) {
    const m = getDbModel(piece.modelId);
    if (m) return { w: m.dimensionsW, d: m.dimensionsD, h: m.dimensionsH };
  }
  const p = getProduct(piece.productId);
  return p ? { w: p.dimensions.w, d: p.dimensions.d, h: p.dimensions.h } : { w: 1, d: 1, h: 1 };
};

export const rectFor = (piece: PlacedFurniture): Rect => {
  const { w, d } = dimsFor(piece);
  // Three.js rotation about +Y maps local +X toward -Z.
  return { cx: piece.x, cz: piece.z, w, d, rot: -piece.rotation };
};

/** SAT (Separating Axis Theorem) for two rotated rectangles on XZ plane. */
export function rectsOverlap(a: Rect, b: Rect, allowContact = false): boolean {
  const corners = (r: Rect) => {
    const cos = Math.cos(r.rot);
    const sin = Math.sin(r.rot);
    const hx = r.w / 2;
    const hz = r.d / 2;
    return [
      [-hx, -hz],
      [hx, -hz],
      [hx, hz],
      [-hx, hz],
    ].map(([x, z]) => [r.cx + x * cos - z * sin, r.cz + x * sin + z * cos] as [number, number]);
  };
  const axes = (r: Rect) => {
    const cos = Math.cos(r.rot);
    const sin = Math.sin(r.rot);
    return [
      [cos, sin],
      [-sin, cos],
    ];
  };
  const aC = corners(a);
  const bC = corners(b);
  const allAxes = [...axes(a), ...axes(b)];
  for (const [ax, az] of allAxes) {
    let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
    for (const [x, z] of aC) {
      const p = x * ax + z * az;
      if (p < aMin) aMin = p;
      if (p > aMax) aMax = p;
    }
    for (const [x, z] of bC) {
      const p = x * ax + z * az;
      if (p < bMin) bMin = p;
      if (p > bMax) bMax = p;
    }
    if (allowContact ? (aMax <= bMin + 1e-6 || bMax <= aMin + 1e-6) : (aMax < bMin || bMax < aMin)) return false;
  }
  return true;
}

/** Test the complete footprint: corners alone miss narrow notches and columns. */
export function isInsideRoom(candidate: PlacedFurniture, room: RoomShape): boolean {
  if (![candidate.x, candidate.z, candidate.rotation, room.width, room.depth].every(Number.isFinite) || room.width <= 0 || room.depth <= 0) return false;
  let geometry;
  try { geometry = getRoomGeometry(room); } catch { return false; }
  if (!geometry.connected || !geometry.simple) return false;
  const r = rectFor(candidate);
  if (![r.w, r.d].every(value => Number.isFinite(value) && value > 0)) return false;
  const cos = Math.cos(r.rot);
  const sin = Math.sin(r.rot);
  const hx = r.w / 2;
  const hz = r.d / 2;
  const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  for (const [x, z] of corners) {
    const wx = r.cx + x * cos - z * sin;
    const wz = r.cz + x * sin + z * cos;
    if (wx < geometry.bounds.minX - 1e-6 || wx > geometry.bounds.maxX + 1e-6 || wz < geometry.bounds.minZ - 1e-6 || wz > geometry.bounds.maxZ + 1e-6) {
      return false;
    }
  }
  return !geometry.voids.some(rect => rectsOverlap(r, { cx: (rect.minX + rect.maxX) / 2, cz: (rect.minZ + rect.maxZ) / 2,
    w: rect.maxX - rect.minX, d: rect.maxZ - rect.minZ, rot: 0 }, true));
}

/** Check furniture against the actual room shape, columns and other furniture. */
export function isPlacementValid(candidate: PlacedFurniture, others: PlacedFurniture[], room: RoomShape): boolean {
  if (!isInsideRoom(candidate, room)) return false;
  if (room.height !== undefined && dimsFor(candidate).h > room.height + 1e-6) return false;
  const r = rectFor(candidate);
  for (const other of others) {
    if (other.instanceId === candidate.instanceId) continue;
    if (rectsOverlap(r, rectFor(other))) return false;
  }
  return true;
}

/** Deterministic nearest free location; returns null instead of overlapping. */
export function findFreePlacement(piece: PlacedFurniture, others: PlacedFurniture[], room: RoomShape): PlacedFurniture | null {
  if (isPlacementValid(piece, others, room)) return piece;
  let bounds;
  try { bounds = getRoomGeometry(room).bounds; } catch { return null; }
  const positions: { x: number; z: number }[] = [];
  for (let x = bounds.minX; x <= bounds.maxX; x += 0.25) {
    for (let z = bounds.minZ; z <= bounds.maxZ; z += 0.25) positions.push({ x, z });
  }
  positions.sort((a, b) => (a.x - piece.x) ** 2 + (a.z - piece.z) ** 2 - ((b.x - piece.x) ** 2 + (b.z - piece.z) ** 2));
  for (const position of positions) {
    const candidate = { ...piece, ...position };
    if (isPlacementValid(candidate, others, room)) return candidate;
  }
  return null;
}

/** Snap a piece's center to the nearest wall when within `threshold` meters. */
export function snapToWall(
  piece: PlacedFurniture,
  room: RoomShape,
  threshold = 0.4,
): PlacedFurniture {
  const { w, d } = dimsFor(piece);
  const cos = Math.abs(Math.cos(piece.rotation));
  const sin = Math.abs(Math.sin(piece.rotation));
  const halfX = (w * cos + d * sin) / 2;
  const halfZ = (w * sin + d * cos) / 2;

  let geometry;
  try { geometry = getRoomGeometry(room); } catch { return piece; }
  const xs: number[] = [], zs: number[] = [];
  for (const wall of geometry.segments) {
    if (wall.nx && piece.z + halfZ >= Math.min(wall.a.z, wall.b.z) && piece.z - halfZ <= Math.max(wall.a.z, wall.b.z)) {
      const x = wall.a.x + wall.nx * halfX;
      if (Math.abs(x - piece.x) <= threshold) xs.push(x);
    }
    if (wall.nz && piece.x + halfX >= Math.min(wall.a.x, wall.b.x) && piece.x - halfX <= Math.max(wall.a.x, wall.b.x)) {
      const z = wall.a.z + wall.nz * halfZ;
      if (Math.abs(z - piece.z) <= threshold) zs.push(z);
    }
  }
  const candidates = [...xs.flatMap(x => zs.map(z => ({ ...piece, x, z }))),
    ...xs.map(x => ({ ...piece, x })), ...zs.map(z => ({ ...piece, z }))];
  candidates.sort((a, b) => Math.hypot(a.x - piece.x, a.z - piece.z) - Math.hypot(b.x - piece.x, b.z - piece.z));
  return candidates.find(candidate => isInsideRoom(candidate, room)) ?? piece;
}
