import type { RoomShape } from "./types";
import type { RoomSegment, Point } from "./roomGeometry";
import type { SharedWallCut } from "./roomLayout";

export const ROOM_WALL_THICKNESS = .2;
export const ROOM_SKIRTING_DEPTH = .02;
export const ROOM_SKIRTING_HEIGHT = .06;

/** Test the finite wall span between the camera and the selected room. */
export function wallBlocksFocus(
  camera: Point,
  focus: Point,
  wall: Point & { nx: number; nz: number; length: number; start: number; end: number },
) {
  const cameraSide = (camera.x - wall.x) * wall.nx + (camera.z - wall.z) * wall.nz;
  const focusSide = (focus.x - wall.x) * wall.nx + (focus.z - wall.z) * wall.nz;
  if (cameraSide * focusSide >= 0) return false;
  const t = cameraSide / (cameraSide - focusSide);
  const x = camera.x + (focus.x - camera.x) * t - wall.x;
  const z = camera.z + (focus.z - camera.z) * t - wall.z;
  const along = x * wall.nz - z * wall.nx;
  return along >= -wall.length / 2 - Math.max(0, wall.start) && along <= wall.length / 2 + Math.max(0, wall.end);
}

const samePoint = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z) < .001;
function sharedCorner(room: RoomShape, point: Point, shared: SharedWallCut[]) {
  return shared.find(cut => {
    const wall = cut.wallId;
    const onWall = wall === "north" ? Math.abs(point.z + room.depth / 2) < .001 : wall === "south" ? Math.abs(point.z - room.depth / 2) < .001 : wall === "east" ? Math.abs(point.x - room.width / 2) < .001 : Math.abs(point.x + room.width / 2) < .001;
    const along = wall === "north" ? point.x + room.width / 2 : wall === "south" ? room.width / 2 - point.x : wall === "east" ? point.z + room.depth / 2 : room.depth / 2 - point.z;
    return onWall && along >= cut.from - .001 && along <= cut.to + .001;
  });
}
/** Miter outside corners so thick walls form one closed outline without gaps. */
export function wallMiterEnds(room: RoomShape, segment: RoomSegment, segments: RoomSegment[], shared: SharedWallCut[] = []) {
  const turn = (a: RoomSegment, b: RoomSegment) => {
    const ax=a.b.x-a.a.x,az=a.b.z-a.a.z,bx=b.b.x-b.a.x,bz=b.b.z-b.a.z;
    if(Math.abs(ax*bx+az*bz)<1e-10)return Math.sign(ax*bz-az*bx);
    return Math.tan(Math.atan2(ax*bz-az*bx,ax*bx+az*bz)/2);
  };
  const previous = segments.find(s => !s.hole && samePoint(s.b, segment.a));
  const next = segments.find(s => !s.hole && samePoint(s.a, segment.b));
  return {
    start: previous && !sharedCorner(room, segment.a, shared) ? Math.max(-segment.length * .45, turn(previous, segment) * ROOM_WALL_THICKNESS) : 0,
    end: next && !sharedCorner(room, segment.b, shared) ? Math.max(-segment.length * .45, turn(segment, next) * ROOM_WALL_THICKNESS) : 0,
  };
}

/** Flat ends at room connections are internal too: a neighbour wall covers them. */
export function wallOpenEnds(room: RoomShape, segment: RoomSegment, segments: RoomSegment[], shared: SharedWallCut[] = []) {
  const ends = wallMiterEnds(room, segment, segments, shared);
  const open = (point: Point, extension: number) => {
    if (Math.abs(extension) === ROOM_WALL_THICKNESS) return true;
    const boundary = sharedCorner(room, point, shared);
    if (!boundary) return false;
    // A taller room still needs an exposed end above its shorter neighbour.
    return boundary.height >= (room.height ?? 2.7) ? true : boundary.height;
  };
  return {
    openStart: open(segment.a, ends.start),
    openEnd: open(segment.b, ends.end),
  };
}
