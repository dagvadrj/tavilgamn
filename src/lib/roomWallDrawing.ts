import type { Point } from "./roomGeometry";
import { polygonArea } from "./roomGeometry";
import { edgesCross, pointOnEdge } from "./roomPolygon";
import { validateRoomBuilder, type RoomBuilderDraft } from "./roomBuilderDraft";
import type { RoomVertex } from "./types";

export type WallDrawingUnit = "mm" | "cm" | "m";
export const wallUnitScale = { mm: 1000, cm: 100, m: 1 };
export const wallUnitLabel = { mm: "мм", cm: "см", m: "м" };
export function formatWallLength(meters: number, unit: WallDrawingUnit) {
  return `${Number((meters * wallUnitScale[unit]).toFixed(unit === "m" ? 3 : 1))} ${wallUnitLabel[unit]}`;
}

export const wallLengthCm = (a: Point, b: Point) =>
  Math.hypot(b.x - a.x, b.z - a.z) * 100;

export function snapWallPoint(
  point: Point,
  start: Point | undefined,
  grid: boolean,
  orthogonal: boolean,
  lengthCm?: number,
): Point {
  const step = grid ? 0.1 : 0.01;
  let x = Math.round(point.x / step) * step;
  let z = Math.round(point.z / step) * step;
  if (start && orthogonal) {
    if (Math.abs(x - start.x) >= Math.abs(z - start.z)) z = start.z;
    else x = start.x;
  }
  if (start && lengthCm !== undefined) {
    const dx = x - start.x,
      dz = z - start.z,
      distance = Math.hypot(dx, dz);
    if (!Number.isFinite(lengthCm) || lengthCm < 5 || lengthCm > 2000)
      throw new Error("Ханын урт 5–2000 см байна.");
    x = start.x + ((distance ? dx / distance : 1) * lengthCm) / 100;
    z = start.z + ((distance ? dz / distance : 0) * lengthCm) / 100;
  }
  return { x: Math.round(x * 10000) / 10000, z: Math.round(z * 10000) / 10000 };
}

/** Reject invalid new edges before they become part of the unfinished polyline. */
export function wallDrawingIssue(points: Point[], next: Point): string | null {
  if (![next.x, next.z].every(Number.isFinite)) return "Ханын цэг буруу байна.";
  if (points.length >= 48) return "Өрөөг 48 хүртэл ханатай зурна.";
  const start = points.at(-1);
  if (!start) return null;
  if (wallLengthCm(start, next) < 5 - 1e-6) return "Хана 5 см-ээс урт байна.";
  // Adjacent edges may meet at their common endpoint, but may not retrace each other.
  if (
    points.length > 1 &&
    (pointOnEdge(next, points[points.length - 2], start) ||
      pointOnEdge(points[points.length - 2], start, next))
  )
    return "Өмнөх ханаа давхарлан зурж болохгүй.";
  for (let i = 0; i < points.length - 2; i++) {
    const a = points[i],
      b = points[i + 1];
    if (
      edgesCross(start, next, a, b) ||
      pointOnEdge(next, a, b) ||
      pointOnEdge(a, start, next) ||
      pointOnEdge(b, start, next)
    )
      return "Хананууд огтлолцож байна. Өөр цэг сонгоорой.";
  }
  return null;
}

function fitOutline(
  draft: RoomBuilderDraft,
  outline: RoomVertex[],
): RoomBuilderDraft {
  const minX = Math.min(...outline.map((p) => p.x)),
    maxX = Math.max(...outline.map((p) => p.x));
  const minZ = Math.min(...outline.map((p) => p.z)),
    maxZ = Math.max(...outline.map((p) => p.z));
  const cx = (minX + maxX) / 2,
    cz = (minZ + maxZ) / 2;
  return {
    ...draft,
    width: Math.max(1, maxX - minX),
    depth: Math.max(1, maxZ - minZ),
    outline: outline.map((p) => ({ ...p, x: p.x - cx, z: p.z - cz })),
  };
}

/** Closing a drawing is one atomic draft edit; either winding direction is accepted. */
export function roomFromWallDrawing(
  draft: RoomBuilderDraft,
  points: Point[],
): RoomBuilderDraft {
  if (
    points.length < 3 ||
    points.length > 48 ||
    points.some((p) => ![p.x, p.z].every(Number.isFinite))
  )
    throw new Error("Гурваас доошгүй хана зураад хүрээгээ хаагаарай.");
  const ordered = polygonArea(points) < 0 ? [...points].reverse() : points;
  const next = fitOutline(
    {
      ...draft,
      openings: [],
      wallMaterials: {},
      wallFeatures: [],
      columns: [],
    },
    ordered.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      segmentId: crypto.randomUUID(),
    })),
  );
  const issue = validateRoomBuilder(next);
  if (issue) throw new Error(issue);
  return next;
}

export function resizeDrawnWall(
  draft: RoomBuilderDraft,
  index: number,
  length: number,
): RoomBuilderDraft {
  const points = draft.outline;
  if (
    !points?.[index] ||
    !Number.isFinite(length) ||
    length < 0.05 ||
    length > 20
  )
    throw new Error("Ханын урт 5–2000 см байна.");
  const a = points[index],
    end = (index + 1) % points.length,
    b = points[end];
  const oldLength = Math.hypot(b.x - a.x, b.z - a.z);
  const next = fitOutline(
    draft,
    points.map((p, i) =>
      i === end
        ? {
            ...p,
            x: a.x + ((b.x - a.x) * length) / oldLength,
            z: a.z + ((b.z - a.z) * length) / oldLength,
          }
        : p,
    ),
  );
  const issue = validateRoomBuilder(next);
  if (issue) throw new Error(issue);
  return next;
}
