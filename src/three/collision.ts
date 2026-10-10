import { cabinetFrontExtra } from "@/lib/plitka";
import type { PlacedFurniture, RoomShape } from "@/lib/types";
import { modelFloorBand } from "@/lib/modelFloorBand";
import { ROOM_SKIRTING_DEPTH } from "@/lib/roomRendering";
import {
  getRoomGeometry,
  type Bounds,
  type RoomGeometry,
} from "@/lib/roomGeometry";
import { getProduct } from "@/store/catalog";
import { getDbModel } from "@/lib/modelRegistry";
import { kitchenEnvelope } from "@/lib/kitchenAssembly";
import { fitCountertops, cabinetAxes } from "@/lib/kitchenPlacement";

export type PlacementRoom = RoomShape & {
  placementGeometry?: Pick<
    RoomGeometry,
    "bounds" | "voids" | "segments" | "connected" | "simple"
  >;
  skirting?: Bounds[];
  heightZones?: Array<Bounds & { height: number }>;
};
const placementGeometry = (room: PlacementRoom) =>
  room.placementGeometry ?? getRoomGeometry(room);

interface Rect {
  cx: number;
  cz: number;
  w: number;
  d: number;
  rot: number;
}

export const dimsFor = (piece: PlacedFurniture) => {
  if (piece.kitchen) {
    const { w, d, h } = kitchenEnvelope(piece.kitchen.design);
    return { w, d, h };
  }
  if (piece.modelId) {
    const m = getDbModel(piece.modelId);
    if (m) return { w: m.dimensionsW, d: m.dimensionsD, h: m.dimensionsH };
  }
  const p = getProduct(piece.productId);
  return p
    ? { w: p.dimensions.w, d: p.dimensions.d, h: p.dimensions.h }
    : { w: 1, d: 1, h: 1 };
};

export const rectFor = (piece: PlacedFurniture): Rect => {
  const { w, d } = dimsFor(piece);
  // Three.js rotation about +Y maps local +X toward -Z.
  return { cx: piece.x, cz: piece.z, w, d, rot: -piece.rotation };
};

/** Each cabinet/top retains its footprint. The empty interior of an L is usable. */
export function pieceRects(piece: PlacedFurniture): Rect[] {
  if (!piece.kitchen) return [rectFor(piece)];
  const design = piece.kitchen.design,
    bounds = kitchenEnvelope(design);
  const parts: Array<{
    width: number;
    depth: number;
    position: { x: number; z: number; rotation: number };
  }> = design.cabinets.map((c) => {
    const extra = cabinetFrontExtra(c);
    const { front } = cabinetAxes(c.position.rotation);
    return {
      width: c.width,
      depth: c.depth + extra,
      position: {
        ...c.position,
        x: c.position.x + (front.x * extra) / 2,
        z: c.position.z + (front.z * extra) / 2,
      },
    };
  });
  parts.push(...fitCountertops(design));
  const cos = Math.cos(piece.rotation),
    sin = Math.sin(piece.rotation);
  return parts.map((part) => {
    const x = (part.position.x - bounds.centerX) / 1000,
      z = (part.position.z - bounds.centerZ) / 1000;
    return {
      cx: piece.x + x * cos + z * sin,
      cz: piece.z - x * sin + z * cos,
      w: part.width / 1000,
      d: part.depth / 1000,
      rot: -piece.rotation - part.position.rotation,
    };
  });
}

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
    ].map(
      ([x, z]) =>
        [r.cx + x * cos - z * sin, r.cz + x * sin + z * cos] as [
          number,
          number,
        ],
    );
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
    let aMin = Infinity,
      aMax = -Infinity,
      bMin = Infinity,
      bMax = -Infinity;
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
    if (
      allowContact
        ? aMax <= bMin + 1e-6 || bMax <= aMin + 1e-6
        : aMax < bMin || bMax < aMin
    )
      return false;
  }
  return true;
}

/** Test the complete footprint: corners alone miss narrow notches and columns. */
export function isInsideRoom(
  candidate: PlacedFurniture,
  room: PlacementRoom,
): boolean {
  if (
    ![
      candidate.x,
      candidate.z,
      candidate.rotation,
      room.width,
      room.depth,
    ].every(Number.isFinite) ||
    room.width <= 0 ||
    room.depth <= 0
  )
    return false;
  let geometry;
  try {
    geometry = placementGeometry(room);
  } catch {
    return false;
  }
  if (!geometry.connected || !geometry.simple) return false;
  return pieceRects(candidate).every((r) => rectInsideGeometry(r, geometry));
}

function rectInsideGeometry(
  r: Rect,
  geometry: Pick<RoomGeometry, "bounds" | "voids">,
): boolean {
  if (![r.w, r.d].every((value) => Number.isFinite(value) && value > 0))
    return false;
  const cos = Math.cos(r.rot);
  const sin = Math.sin(r.rot);
  const hx = r.w / 2;
  const hz = r.d / 2;
  const corners = [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz],
  ];
  for (const [x, z] of corners) {
    const wx = r.cx + x * cos - z * sin;
    const wz = r.cz + x * sin + z * cos;
    if (
      wx < geometry.bounds.minX - 1e-6 ||
      wx > geometry.bounds.maxX + 1e-6 ||
      wz < geometry.bounds.minZ - 1e-6 ||
      wz > geometry.bounds.maxZ + 1e-6
    ) {
      return false;
    }
  }
  return !geometry.voids.some((rect) =>
    rectsOverlap(
      r,
      {
        cx: (rect.minX + rect.maxX) / 2,
        cz: (rect.minZ + rect.maxZ) / 2,
        w: rect.maxX - rect.minX,
        d: rect.maxZ - rect.minZ,
        rot: 0,
      },
      true,
    ),
  );
}

/** Only the part below the skirting top collides with the skirting. */
export function floorBandRects(piece: PlacedFurniture): Rect[] {
  const dims = dimsFor(piece),
    model = piece.modelId ? getDbModel(piece.modelId) : undefined;
  const band = model
    ? modelFloorBand(model.fileModelId ?? model.id, dims)
    : undefined;
  if (!band) return pieceRects(piece); // Conservative while an imported model is still downloading.
  const cos = Math.cos(piece.rotation),
    sin = Math.sin(piece.rotation);
  return band.map((b) => {
    const x = (b.minX + b.maxX) / 2,
      z = (b.minZ + b.maxZ) / 2;
    return {
      cx: piece.x + x * cos + z * sin,
      cz: piece.z - x * sin + z * cos,
      w: b.maxX - b.minX,
      d: b.maxZ - b.minZ,
      rot: -piece.rotation,
    };
  });
}
const hitsSkirting = (piece: PlacedFurniture, room: PlacementRoom) => {
  if (!room.skirting?.length) return false;
  const feet = floorBandRects(piece);
  return room.skirting.some((b) =>
    feet.some((r) =>
      rectsOverlap(
        r,
        {
          cx: (b.minX + b.maxX) / 2,
          cz: (b.minZ + b.maxZ) / 2,
          w: b.maxX - b.minX,
          d: b.maxZ - b.minZ,
          rot: 0,
        },
        true,
      ),
    ),
  );
};

/** Check furniture against the actual room shape, columns and other furniture. */
export function isPlacementValid(
  candidate: PlacedFurniture,
  others: PlacedFurniture[],
  room: PlacementRoom,
): boolean {
  if (!isInsideRoom(candidate, room) || hitsSkirting(candidate, room))
    return false;
  if (
    !room.heightZones &&
    room.height !== undefined &&
    dimsFor(candidate).h > room.height + 1e-6
  )
    return false;
  const rectangles = pieceRects(candidate);
  if (
    room.heightZones?.some(
      (zone) =>
        dimsFor(candidate).h > zone.height + 1e-6 &&
        rectangles.some((r) =>
          rectsOverlap(
            r,
            {
              cx: (zone.minX + zone.maxX) / 2,
              cz: (zone.minZ + zone.maxZ) / 2,
              w: zone.maxX - zone.minX,
              d: zone.maxZ - zone.minZ,
              rot: 0,
            },
            true,
          ),
        ),
    )
  )
    return false;
  for (const other of others) {
    if (other.instanceId === candidate.instanceId) continue;
    if (
      rectangles.some((r) =>
        pieceRects(other).some((o) => rectsOverlap(r, o, true)),
      )
    )
      return false;
  }
  return true;
}

/** Deterministic nearest free location; returns null instead of overlapping. */
export function findFreePlacement(
  piece: PlacedFurniture,
  others: PlacedFurniture[],
  room: PlacementRoom,
): PlacedFurniture | null {
  if (isPlacementValid(piece, others, room)) return piece;
  let bounds;
  try {
    bounds = placementGeometry(room).bounds;
  } catch {
    return null;
  }
  const positions: { x: number; z: number }[] = [];
  const { w, d } = dimsFor(piece),
    cos = Math.abs(Math.cos(piece.rotation)),
    sin = Math.abs(Math.sin(piece.rotation));
  const hx = (w * cos + d * sin) / 2,
    hz = (w * sin + d * cos) / 2;
  // Include exact wall-aligned centres: a 0.25 m search grid misses snug fits.
  const xs = new Set([
    piece.x,
    (bounds.minX + bounds.maxX) / 2,
    bounds.minX + hx,
    bounds.maxX - hx,
  ]);
  const zs = new Set([
    piece.z,
    (bounds.minZ + bounds.maxZ) / 2,
    bounds.minZ + hz,
    bounds.maxZ - hz,
  ]);
  for (const wall of placementGeometry(room).segments) {
    if (wall.nx) xs.add(wall.a.x + wall.nx * hx);
    if (wall.nz) zs.add(wall.a.z + wall.nz * hz);
  }
  for (let x = bounds.minX; x <= bounds.maxX; x += 0.25) xs.add(x);
  for (let z = bounds.minZ; z <= bounds.maxZ; z += 0.25) zs.add(z);
  for (const x of xs) for (const z of zs) positions.push({ x, z });
  positions.sort(
    (a, b) =>
      (a.x - piece.x) ** 2 +
      (a.z - piece.z) ** 2 -
      ((b.x - piece.x) ** 2 + (b.z - piece.z) ** 2),
  );
  for (const position of positions) {
    const candidate = { ...piece, ...position };
    if (isPlacementValid(candidate, others, room)) return candidate;
  }
  return null;
}

/** Snap a piece's center to the nearest wall when within `threshold` meters. */
export function snapToWall(
  piece: PlacedFurniture,
  room: PlacementRoom,
  threshold = 0.4,
): PlacedFurniture {
  const { w, d } = dimsFor(piece);
  const cos = Math.abs(Math.cos(piece.rotation));
  const sin = Math.abs(Math.sin(piece.rotation));
  const halfX = (w * cos + d * sin) / 2;
  const halfZ = (w * sin + d * cos) / 2;

  let geometry;
  try {
    geometry = placementGeometry(room);
  } catch {
    return piece;
  }
  const feet = floorBandRects(piece),
    footCorners = feet.flatMap((r) =>
      [
        [-r.w / 2, -r.d / 2],
        [r.w / 2, -r.d / 2],
        [r.w / 2, r.d / 2],
        [-r.w / 2, r.d / 2],
      ].map(([x, z]) => ({
        x: r.cx - piece.x + x * Math.cos(r.rot) - z * Math.sin(r.rot),
        z: r.cz - piece.z + x * Math.sin(r.rot) + z * Math.cos(r.rot),
      })),
    );
  const board = room.skirting ? ROOM_SKIRTING_DEPTH : 0;
  const minFootX = Math.min(...footCorners.map((p) => p.x)),
    maxFootX = Math.max(...footCorners.map((p) => p.x)),
    minFootZ = Math.min(...footCorners.map((p) => p.z)),
    maxFootZ = Math.max(...footCorners.map((p) => p.z));
  const xs: number[] = [],
    zs: number[] = [];
  for (const wall of geometry.segments) {
    if (
      wall.nx &&
      piece.z + halfZ >= Math.min(wall.a.z, wall.b.z) &&
      piece.z - halfZ <= Math.max(wall.a.z, wall.b.z)
    ) {
      const x =
        wall.a.x +
        wall.nx * Math.max(halfX, board + (wall.nx > 0 ? -minFootX : maxFootX));
      if (Math.abs(x - piece.x) <= threshold) xs.push(x);
    }
    if (
      wall.nz &&
      piece.x + halfX >= Math.min(wall.a.x, wall.b.x) &&
      piece.x - halfX <= Math.max(wall.a.x, wall.b.x)
    ) {
      const z =
        wall.a.z +
        wall.nz * Math.max(halfZ, board + (wall.nz > 0 ? -minFootZ : maxFootZ));
      if (Math.abs(z - piece.z) <= threshold) zs.push(z);
    }
  }
  const candidates = [
    ...xs.flatMap((x) => zs.map((z) => ({ ...piece, x, z }))),
    ...xs.map((x) => ({ ...piece, x })),
    ...zs.map((z) => ({ ...piece, z })),
  ];
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - piece.x, a.z - piece.z) -
      Math.hypot(b.x - piece.x, b.z - piece.z),
  );
  return (
    candidates.find(
      (candidate) =>
        isInsideRoom(candidate, room) && !hitsSkirting(candidate, room),
    ) ?? piece
  );
}
