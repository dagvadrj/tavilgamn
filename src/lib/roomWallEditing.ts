import type { RoomShape, RoomWall, WallFeature } from "./types";
import { getRoomGeometry, ROOM_WALLS, type Point, type RoomSegment } from "./roomGeometry";
import { validateRoomOpenings } from "./roomOpenings";

type FeaturePart = "face" | "start" | "end";
type Axis = "x" | "z";

export interface RoomWallTarget {
  /** Unique for a visible fragment, stable while the perimeter topology is unchanged. */
  id: string;
  segment: RoomSegment;
  /** Index among the outer segments, matching the plan's Х1, Х2, … labels. */
  segmentIndex: number;
  label: string;
  /** World axis perpendicular to this visible wall. */
  axis: Axis;
  kind: "wall" | "feature";
  wall: RoomWall;
  featureId?: string;
  featurePart?: FeaturePart;
}

type Owner = Omit<RoomWallTarget, "id" | "segment" | "segmentIndex" | "label"> & { key: string; name: string };
type Edge = { axis: Axis; at: number; from: number; to: number; nx: number; nz: number; owner?: Owner };
const WALLS: RoomWall[] = ["north", "east", "south", "west"];
const mm = (value: number) => Math.round(value * 1000);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const vector = (wall: RoomWall) => ({
  north: { ux: 1, uz: 0, nx: 0, nz: 1 }, east: { ux: 0, uz: 1, nx: -1, nz: 0 },
  south: { ux: -1, uz: 0, nx: 0, nz: -1 }, west: { ux: 0, uz: -1, nx: 1, nz: 0 },
})[wall];

/** Source edges use integer millimetres measured from A, like roomGeometry. */
function sourceEdges(room: RoomShape): Edge[] {
  const w = mm(room.width), d = mm(room.depth), edges: Edge[] = [];
  const add = (ax: number, az: number, bx: number, bz: number, nx: number, nz: number, owner?: Omit<Owner, "axis">) => {
    const axis: Axis = ax === bx ? "x" : "z";
    edges.push({ axis, at: axis === "x" ? ax : az, from: Math.min(axis === "x" ? az : ax, axis === "x" ? bz : bx),
      to: Math.max(axis === "x" ? az : ax, axis === "x" ? bz : bx), nx, nz, owner: owner && { ...owner, axis } });
  };
  for (const wall of WALLS) {
    const { ux, uz, nx, nz } = vector(wall);
    const ox = wall === "east" || wall === "south" ? w : 0;
    const oz = wall === "south" || wall === "west" ? d : 0;
    const length = wall === "north" || wall === "south" ? w : d;
    add(ox, oz, ox + ux * length, oz + uz * length, nx, nz,
      { key: `wall:${wall}`, name: ROOM_WALLS[wall], kind: "wall", wall });
  }
  for (const [index, feature] of (room.wallFeatures ?? []).entries()) {
    const { wall } = feature, { ux, uz, nx, nz } = vector(wall);
    const offset = mm(feature.offset), length = mm(feature.length);
    const direction = feature.kind === "inset" ? 1 : -1, depth = mm(feature.depth) * direction;
    const ax = (wall === "east" || wall === "south" ? w : 0) + ux * offset;
    const az = (wall === "south" || wall === "west" ? d : 0) + uz * offset;
    const bx = ax + ux * length, bz = az + uz * length;
    const owner = (featurePart: FeaturePart): Omit<Owner, "axis"> => ({
      key: `feature:${feature.id}:${featurePart}`, name: `Ханын хэсэг ${index + 1} · ${{ face: "гүн", start: "эхлэл", end: "төгсгөл" }[featurePart]}`,
      kind: "feature", wall, featureId: feature.id, featurePart,
    });
    add(ax + nx * depth, az + nz * depth, bx + nx * depth, bz + nz * depth, nx, nz, owner("face"));
    add(ax, az, ax + nx * depth, az + nz * depth, -ux * direction, -uz * direction, owner("start"));
    add(bx, bz, bx + nx * depth, bz + nz * depth, ux * direction, uz * direction, owner("end"));
  }
  // A column attached to a wall appears in the outer loop, but resizing that edge
  // must never silently resize the room or an overlapping wall feature.
  for (const column of room.columns ?? []) {
    const x = mm(column.x), z = mm(column.z), right = mm(column.x + column.width), bottom = mm(column.z + column.depth);
    add(x, z, right, z, 0, -1); add(right, z, right, bottom, 1, 0);
    add(right, bottom, x, bottom, 0, 1); add(x, bottom, x, z, -1, 0);
  }
  return edges;
}

/**
 * Split merged collinear perimeter edges at their source boundaries, so a long
 * displayed wall can still expose the individual feature sides that formed it.
 * Holes, column cuts, and edges owned by multiple overlapping features are not
 * editable by a single wall drag; their existing numeric editors remain usable.
 */
export function getRoomWallTargets(room: RoomShape): RoomWallTarget[] {
  const geometry = getRoomGeometry(room), sources = sourceEdges(room), targets: RoomWallTarget[] = [];
  const halfW = mm(room.width) / 2, halfD = mm(room.depth) / 2, counts = new Map<string, number>();
  geometry.segments.filter(segment => !segment.hole).forEach((segment, segmentIndex) => {
    const ax = Math.round(segment.a.x * 1000 + halfW), az = Math.round(segment.a.z * 1000 + halfD);
    const bx = Math.round(segment.b.x * 1000 + halfW), bz = Math.round(segment.b.z * 1000 + halfD);
    const axis: Axis = ax === bx ? "x" : "z", at = axis === "x" ? ax : az;
    const start = axis === "x" ? az : ax, end = axis === "x" ? bz : bx;
    const from = Math.min(start, end), to = Math.max(start, end);
    const matching = sources.filter(edge => edge.axis === axis && edge.at === at && edge.nx === segment.nx && edge.nz === segment.nz && edge.to > from && edge.from < to);
    const breaks = [...new Set([from, to, ...matching.flatMap(edge => [clamp(edge.from, from, to), clamp(edge.to, from, to)])])].sort((a, b) => start < end ? a - b : b - a);
    for (let index = 0; index < breaks.length - 1; index++) {
      const a = breaks[index], b = breaks[index + 1], mid = (a + b) / 2;
      const owners = matching.filter(edge => mid > edge.from && mid < edge.to);
      if (owners.length !== 1 || !owners[0].owner) continue;
      const { key, name, ...owner } = owners[0].owner;
      const ordinal = counts.get(key) ?? 0;
      counts.set(key, ordinal + 1);
      const point = (along: number) => ({ x: ((axis === "x" ? at : along) - halfW) / 1000, z: ((axis === "x" ? along : at) - halfD) / 1000 });
      targets.push({ ...owner, id: `${key}:${ordinal}`, segmentIndex, label: `Х${segmentIndex + 1} · ${name}`,
        segment: { ...segment, a: point(a), b: point(b), length: Math.abs(b - a) / 1000 } });
    }
  });
  return targets;
}

/** Keep contents anchored in physical space when the base rectangle is resized. */
function resizeFromWall(room: RoomShape, wall: RoomWall, size: number): { room: RoomShape; contentShift: Point } {
  const horizontal = wall === "east" || wall === "west", key = horizontal ? "width" : "depth";
  const oldSpan = mm(room[key]), change = size - oldSpan;
  const startMoved = wall === "west" || wall === "north";
  const contentShift = { x: horizontal ? change * (startMoved ? 1 : -1) / 2000 : 0,
    z: horizontal ? 0 : change * (startMoved ? 1 : -1) / 2000 };
  const resizedWall = (other: RoomWall) => horizontal ? other === "north" || other === "south" : other === "east" || other === "west";
  // Offsets run clockwise, so the opposite parallel edge has the reverse origin.
  const originMoved = (other: RoomWall) => ({ east: "south", west: "north", north: "east", south: "west" }[wall]) === other;
  return { contentShift, room: { ...room, [key]: size / 1000,
    columns: room.columns?.map(column => ({ ...column,
      x: wall === "west" ? (mm(column.x) + change) / 1000 : column.x,
      z: wall === "north" ? (mm(column.z) + change) / 1000 : column.z,
    })),
    wallFeatures: room.wallFeatures?.map(feature => {
      if (!resizedWall(feature.wall)) return feature;
      const offset = mm(feature.offset), length = mm(feature.length), end = offset + length;
      // A full-span feature stretches with that wall. A feature attached to the
      // moving corner keeps its size and follows that corner; all other feature
      // endpoints stay physically stationary. This preserves corner obstruction
      // dimensions instead of silently turning a 600 mm corner into a 1600 mm one.
      if (offset === 0 && end === oldSpan) return { ...feature, offset: 0, length: size / 1000 };
      const fromStart = originMoved(feature.wall);
      const nextOffset = fromStart ? (offset === 0 ? 0 : offset + change) : (end === oldSpan ? offset + change : offset);
      return { ...feature, offset: nextOffset / 1000 };
    }),
    openings: room.openings?.map(opening => resizedWall(opening.wallId) ? { ...opening,
      // Preserve sub-millimetre centers as well: only the user's drag delta is
      // rounded, never an existing opening's center or normalized fraction.
      position: (oldSpan * opening.position + (originMoved(opening.wallId) ? change : 0)) / size,
    } : opening),
  } };
}

/**
 * Apply a world-axis delta to the original gesture shape, rounded once to 1 mm.
 * Base-wall resizing keeps the opposite wall, columns, and opening centers
 * physically stationary; features on the moved wall follow it. The resulting
 * shape is normalized about its new center. Apply contentShift to furniture and
 * light fixtures atomically with this shape; offset the drawing by its inverse
 * during a gesture to keep the unchanged opposite wall visually stationary.
 */
export function moveRoomWall(room: RoomShape, target: RoomWallTarget, deltaMetres: number): { room: RoomShape; error: string | null; contentShift?: Point } {
  if (!Number.isFinite(deltaMetres)) return { room, error: "Ханын шилжилтэд зөв тоо оруулна уу." };
  const existingProblem = validateRoomOpenings(room);
  if (existingProblem) return { room, error: existingProblem };
  const current = getRoomWallTargets(room).find(item => item.id === target.id);
  if (!current || current.kind !== target.kind || current.wall !== target.wall || current.featureId !== target.featureId || current.featurePart !== target.featurePart || current.axis !== target.axis) {
    return { room, error: "Энэ ханын хэсгийг дахин сонгоно уу." };
  }
  const delta = mm(deltaMetres);
  let next: RoomShape, contentShift: Point | undefined;
  if (target.kind === "wall") {
    const key = target.axis === "x" ? "width" : "depth";
    const sign = target.wall === "east" || target.wall === "south" ? 1 : -1;
    const resized = resizeFromWall(room, target.wall, clamp(mm(room[key]) + delta * sign, 1000, 20000));
    next = resized.room;
    contentShift = resized.contentShift;
  } else {
    const feature = room.wallFeatures!.find(item => item.id === target.featureId)!;
    const { ux, uz, nx, nz } = vector(feature.wall), offset = mm(feature.offset), length = mm(feature.length);
    const span = mm(feature.wall === "north" || feature.wall === "south" ? room.width : room.depth);
    let changed: WallFeature;
    if (target.featurePart === "face") {
      const sign = (target.axis === "x" ? nx : nz) * (feature.kind === "inset" ? 1 : -1);
      changed = { ...feature, depth: clamp(mm(feature.depth) + delta * sign, 50, 3000) / 1000 };
    } else {
      const along = delta * (target.axis === "x" ? ux : uz);
      if (target.featurePart === "start") {
        const nextOffset = clamp(offset + along, 0, offset + length - 50);
        changed = { ...feature, offset: nextOffset / 1000, length: (offset + length - nextOffset) / 1000 };
      } else {
        changed = { ...feature, length: clamp(length + along, 50, span - offset) / 1000 };
      }
    }
    next = { ...room, wallFeatures: room.wallFeatures!.map(item => item.id === feature.id ? changed : item) };
  }
  const error = validateRoomOpenings(next);
  return error ? { room, error } : { room: next, error: null, ...(contentShift ? { contentShift } : {}) };
}
