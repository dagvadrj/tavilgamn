export type FloorBandRect = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type FloorBandSize = { w: number; h: number; d: number };

type FloorBandEntry = {
  rects: FloorBandRect[];
  source: string;
  high: boolean;
};

// Placement needs only these rectangles. Keep this cache independent of Three.js
// so auth and persisted room designs do not load the geometry processor.
const cache = new Map<string, FloorBandEntry>();
const keyFor = (id: string, size: FloorBandSize) =>
  JSON.stringify([id, size.w, size.h, size.d]);

export const getModelFloorBandEntry = (id: string, size: FloorBandSize) =>
  cache.get(keyFor(id, size));

export const modelFloorBand = (id: string, size: FloorBandSize) =>
  getModelFloorBandEntry(id, size)?.rects;

export function cacheModelFloorBand(
  id: string,
  size: FloorBandSize,
  entry: FloorBandEntry,
) {
  const key = keyFor(id, size);
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > 128) cache.delete(cache.keys().next().value!);
}
