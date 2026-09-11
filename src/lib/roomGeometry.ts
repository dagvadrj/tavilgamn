import type { RoomShape, RoomType, RoomWall, WallFeature } from "./types";

export const ROOM_TYPES: Record<RoomType, { label: string; width: number; depth: number }> = {
  living: { label: "Зочны өрөө", width: 5, depth: 4 },
  bedroom: { label: "Унтлагын өрөө", width: 4, depth: 3.5 },
  kitchen: { label: "Гал тогоо", width: 3.5, depth: 3 },
  bathroom: { label: "Угаалгын өрөө", width: 2.5, depth: 2 },
  office: { label: "Ажлын өрөө", width: 3.5, depth: 3 },
  other: { label: "Бусад өрөө", width: 4, depth: 4 },
};
export const ROOM_WALLS: Record<RoomWall, string> = { north: "AB · арын хана", east: "BC · баруун хана", south: "CD · урд хана", west: "DA · зүүн хана" };
export type Point = { x: number; z: number };
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type RoomSegment = { a: Point; b: Point; nx: number; nz: number; length: number; hole: boolean };
export type RoomGeometry = {
  bounds: Bounds; loops: Point[][]; segments: RoomSegment[]; voids: Bounds[];
  area: number; connected: boolean; simple: boolean;
};
const cache = new Map<string, RoomGeometry>();
const inside = (x: number, z: number, rect: Bounds) => x > rect.minX && x < rect.maxX && z > rect.minZ && z < rect.maxZ;
export const polygonArea = (points: Point[]) => points.reduce((sum, p, index) => {
  const next = points[(index + 1) % points.length];
  return sum + p.x * next.z - next.x * p.z;
}, 0) / 2;

/** Millimetre integer grid avoids cracks where measurements share a boundary. */
function featureRect(room: RoomShape, feature: WallFeature): Bounds {
  const w = Math.round(room.width * 1000), d = Math.round(room.depth * 1000);
  const offset = Math.round(feature.offset * 1000), length = Math.round(feature.length * 1000), depth = Math.round(feature.depth * 1000);
  const inward = feature.kind === "inset";
  switch (feature.wall) {
    case "north": return { minX: offset, maxX: offset + length, minZ: inward ? 0 : -depth, maxZ: inward ? depth : 0 };
    case "east": return { minX: inward ? w - depth : w, maxX: inward ? w : w + depth, minZ: offset, maxZ: offset + length };
    case "south": return { minX: w - offset - length, maxX: w - offset, minZ: inward ? d - depth : d, maxZ: inward ? d : d + depth };
    case "west": return { minX: inward ? 0 : -depth, maxX: inward ? depth : 0, minZ: d - offset - length, maxZ: d - offset };
  }
}

function basicError(room: RoomShape): string | null {
  if (![room.width, room.depth].every(value => Number.isFinite(value) && value >= 1 && value <= 20)) return "Өргөн, урт тус бүр 1000–20000 мм байна.";
  if (!Number.isFinite(room.height ?? 2.7) || (room.height ?? 2.7) < 2 || (room.height ?? 2.7) > 5) return "Ханын өндөр 2000–5000 мм байна.";
  if ((room.wallFeatures?.length ?? 0) > 24 || (room.columns?.length ?? 0) > 12) return "Нэг өрөөнд 24 хүртэл ханын хэсэг, 12 хүртэл багана оруулна.";
  for (const feature of room.wallFeatures ?? []) {
    if (!(feature.wall in ROOM_WALLS) || !["inset", "recess"].includes(feature.kind)) return "Ханын хэсгийн төрлийг сонгоно уу.";
    const span = feature.wall === "north" || feature.wall === "south" ? room.width : room.depth;
    const perpendicular = feature.wall === "north" || feature.wall === "south" ? room.depth : room.width;
    if (![feature.offset, feature.length, feature.depth].every(Number.isFinite) || feature.offset < 0 || feature.length < 0.05 || feature.depth < 0.05 || feature.depth > 3 || feature.offset + feature.length > span + 0.000001) return "Ханын хэсэг сонгосон ханандаа багтсан, урт нь 50 мм-ээс эхэлсэн, гүн нь 50–3000 мм байна.";
    if (feature.kind === "inset" && feature.depth >= perpendicular) return "Товойлтын гүн өрөөг бүхэлд нь хөндлөн хааж болохгүй.";
    const competing = (room.wallFeatures ?? []).some(other => other !== feature && other.id !== feature.id && other.wall === feature.wall &&
      Math.min(feature.offset + feature.length, other.offset + other.length) - Math.max(feature.offset, other.offset) > 0.000001);
    if (competing) return "Нэг ханан дээрх хэсгүүд давхцаж байна. Эхлэх зай эсвэл уртыг нь өөрчилнө үү.";
  }
  for (const column of room.columns ?? []) {
    if (![column.x, column.z, column.width, column.depth].every(Number.isFinite) || column.width < 0.05 || column.depth < 0.05 || column.x < 0 || column.z < 0 || column.x + column.width > room.width + 0.000001 || column.z + column.depth > room.depth + 0.000001) return "Багана үндсэн өрөөнд багтсан, хоёр тал нь 50 мм-ээс эхэлсэн байна.";
  }
  return null;
}

export function getRoomGeometry(room: RoomShape): RoomGeometry {
  const problem = basicError(room);
  if (problem) throw new Error(problem);
  const key = JSON.stringify([room.width, room.depth, room.wallFeatures ?? [], room.columns ?? []]);
  const saved = cache.get(key);
  if (saved) return saved;
  const w = Math.round(room.width * 1000), d = Math.round(room.depth * 1000);
  const base = { minX: 0, maxX: w, minZ: 0, maxZ: d };
  const additions = (room.wallFeatures ?? []).filter(f => f.kind === "recess").map(f => featureRect(room, f));
  const cuts = (room.wallFeatures ?? []).filter(f => f.kind === "inset").map(f => featureRect(room, f));
  for (const column of room.columns ?? []) cuts.push({ minX: Math.round(column.x * 1000), maxX: Math.round((column.x + column.width) * 1000), minZ: Math.round(column.z * 1000), maxZ: Math.round((column.z + column.depth) * 1000) });
  const all = [base, ...additions, ...cuts];
  const xs = Array.from(new Set(all.flatMap(r => [r.minX, r.maxX]))).sort((a, b) => a - b);
  const zs = Array.from(new Set(all.flatMap(r => [r.minZ, r.maxZ]))).sort((a, b) => a - b);
  const cols = xs.length - 1, rows = zs.length - 1;
  const filled = new Uint8Array(cols * rows);
  let cellCount = 0, area = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const x = (xs[i] + xs[i + 1]) / 2, z = (zs[j] + zs[j + 1]) / 2;
    if ((inside(x, z, base) || additions.some(rect => inside(x, z, rect))) && !cuts.some(rect => inside(x, z, rect))) {
      filled[j * cols + i] = 1; cellCount++;
      area += (xs[i + 1] - xs[i]) * (zs[j + 1] - zs[j]);
    }
  }
  const start = filled.indexOf(1), visited = new Set<number>();
  const queue = start < 0 ? [] : [start];
  for (let at = 0; at < queue.length; at++) {
    const index = queue[at];
    if (visited.has(index)) continue;
    visited.add(index);
    const i = index % cols, j = Math.floor(index / cols);
    for (const [ni, nj] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) {
      const next = nj * cols + ni;
      if (ni >= 0 && ni < cols && nj >= 0 && nj < rows && filled[next] && !visited.has(next)) queue.push(next);
    }
  }
  const point = (i: number, j: number): Point => ({ x: (xs[i] - w / 2) / 1000, z: (zs[j] - d / 2) / 1000 });
  const outgoing = new Map<string, { from: Point; to: Point; next: string }>();
  let simple = true;
  const edge = (i: number, j: number, ni: number, nj: number) => {
    const id = `${i},${j}`;
    if (outgoing.has(id)) simple = false;
    outgoing.set(id, { from: point(i, j), to: point(ni, nj), next: `${ni},${nj}` });
  };
  const has = (i: number, j: number) => i >= 0 && i < cols && j >= 0 && j < rows && filled[j * cols + i];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (has(i, j)) {
    if (!has(i, j - 1)) edge(i, j, i + 1, j);
    if (!has(i + 1, j)) edge(i + 1, j, i + 1, j + 1);
    if (!has(i, j + 1)) edge(i + 1, j + 1, i, j + 1);
    if (!has(i - 1, j)) edge(i, j + 1, i, j);
  }
  const loops: Point[][] = [];
  while (outgoing.size) {
    const first = outgoing.keys().next().value as string;
    let current = first;
    const points: Point[] = [];
    do {
      const item = outgoing.get(current);
      if (!item) { simple = false; break; }
      points.push(item.from); outgoing.delete(current); current = item.next;
    } while (current !== first);
    const reduced = points.filter((p, index) => {
      const prev = points[(index + points.length - 1) % points.length], next = points[(index + 1) % points.length];
      return Math.abs((p.x - prev.x) * (next.z - p.z) - (p.z - prev.z) * (next.x - p.x)) > 1e-10;
    });
    if (reduced.length >= 4) loops.push(reduced);
  }
  const segments: RoomSegment[] = loops.flatMap(loop => loop.map((a, index) => {
    const b = loop[(index + 1) % loop.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    return { a, b, length, nx: -(b.z - a.z) / length, nz: (b.x - a.x) / length, hole: polygonArea(loop) < 0 };
  }));
  // Merge empty cells into rectangles for fast, exact rotated-footprint collision checks.
  const voids: Bounds[] = [];
  let previous = new Map<string, Bounds>();
  for (let j = 0; j < rows; j++) {
    const next = new Map<string, Bounds>();
    for (let i = 0; i < cols;) {
      if (has(i, j)) { i++; continue; }
      const first = i;
      while (i < cols && !has(i, j)) i++;
      const id = `${first}:${i}`, prior = previous.get(id);
      const rect = prior ?? { minX: point(first, j).x, maxX: point(i, j).x, minZ: point(first, j).z, maxZ: 0 };
      rect.maxZ = point(i, j + 1).z;
      if (!prior) voids.push(rect);
      next.set(id, rect);
    }
    previous = next;
  }
  const geometry: RoomGeometry = { bounds: { minX: point(0, 0).x, maxX: point(cols, 0).x, minZ: point(0, 0).z, maxZ: point(0, rows).z },
    loops, segments, voids, area: area / 1_000_000, connected: cellCount > 0 && visited.size === cellCount, simple };
  if (cache.size >= 20) cache.delete(cache.keys().next().value as string);
  cache.set(key, geometry);
  return geometry;
}

export function validateRoomShape(room: RoomShape): string | null {
  const problem = basicError(room);
  if (problem) return problem;
  const geometry = getRoomGeometry(room);
  if (!geometry.connected || geometry.area < 1) return "Өрөөний ашиглах хэсэг тасарсан эсвэл 1 м²-аас бага боллоо. Товойлт, баганын хэмжээг өөрчилнө үү.";
  if (!geometry.simple) return "Хэсгүүд зөвхөн нэг цэгээр нийлж байна. Байрлалыг нь бага зэрэг зайлуулна уу.";
  return null;
}

export function roomPath(room: RoomShape, scale = 1) {
  return getRoomGeometry(room).loops.map(loop => loop.map((p, index) => `${index ? "L" : "M"}${p.x * scale},${p.z * scale}`).join(" ") + " Z").join(" ");
}
