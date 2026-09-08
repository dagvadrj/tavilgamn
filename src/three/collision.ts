import type { PlacedFurniture } from "@/lib/types";
import { getProduct } from "@/store/catalog";
import { getDbModel } from "@/lib/modelRegistry";

interface Rect {
  cx: number;
  cz: number;
  w: number;
  d: number;
  rot: number;
}

const dimsFor = (piece: PlacedFurniture) => {
  if (piece.modelId) {
    const m = getDbModel(piece.modelId);
    if (m) return { w: m.dimensionsW, d: m.dimensionsD };
  }
  const p = getProduct(piece.productId);
  return p ? { w: p.dimensions.w, d: p.dimensions.d } : { w: 1, d: 1 };
};

export const rectFor = (piece: PlacedFurniture): Rect => {
  const { w, d } = dimsFor(piece);
  // Three.js rotation about +Y maps local +X toward -Z.
  return { cx: piece.x, cz: piece.z, w, d, rot: -piece.rotation };
};

/** SAT (Separating Axis Theorem) for two rotated rectangles on XZ plane. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
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
    if (aMax < bMin || bMax < aMin) return false;
  }
  return true;
}

/** Check piece vs every other piece and against room bounds. */
export function isPlacementValid(
  candidate: PlacedFurniture,
  others: PlacedFurniture[],
  room: { width: number; depth: number },
): boolean {
  if (![candidate.x, candidate.z, candidate.rotation, room.width, room.depth].every(Number.isFinite) || room.width <= 0 || room.depth <= 0) return false;
  const r = rectFor(candidate);
  const cos = Math.cos(r.rot);
  const sin = Math.sin(r.rot);
  const hx = r.w / 2;
  const hz = r.d / 2;
  const corners = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]];
  for (const [x, z] of corners) {
    const wx = r.cx + x * cos - z * sin;
    const wz = r.cz + x * sin + z * cos;
    if (wx < -room.width / 2 - 1e-6 || wx > room.width / 2 + 1e-6 || wz < -room.depth / 2 - 1e-6 || wz > room.depth / 2 + 1e-6) {
      return false;
    }
  }
  for (const other of others) {
    if (other.instanceId === candidate.instanceId) continue;
    if (rectsOverlap(r, rectFor(other))) return false;
  }
  return true;
}

/** Deterministic nearest free location; returns null instead of overlapping. */
export function findFreePlacement(piece: PlacedFurniture, others: PlacedFurniture[], room: { width: number; depth: number }): PlacedFurniture | null {
  if (isPlacementValid(piece, others, room)) return piece;
  const positions: { x: number; z: number }[] = [];
  for (let x = -room.width / 2; x <= room.width / 2; x += 0.25) {
    for (let z = -room.depth / 2; z <= room.depth / 2; z += 0.25) positions.push({ x, z });
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
  room: { width: number; depth: number },
  threshold = 0.4,
): PlacedFurniture {
  const { w, d } = dimsFor(piece);
  const cos = Math.abs(Math.cos(piece.rotation));
  const sin = Math.abs(Math.sin(piece.rotation));
  const halfX = (w * cos + d * sin) / 2;
  const halfZ = (w * sin + d * cos) / 2;

  let nx = piece.x;
  let nz = piece.z;
  if (piece.x - halfX < -room.width / 2 + threshold) nx = -room.width / 2 + halfX;
  if (piece.x + halfX > room.width / 2 - threshold) nx = room.width / 2 - halfX;
  if (piece.z - halfZ < -room.depth / 2 + threshold) nz = -room.depth / 2 + halfZ;
  if (piece.z + halfZ > room.depth / 2 - threshold) nz = room.depth / 2 - halfZ;
  return { ...piece, x: nx, z: nz };
}
