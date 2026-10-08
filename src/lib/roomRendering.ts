import type { RoomShape } from "./types";
import type { RoomSegment, Point } from "./roomGeometry";
import type { SharedWallCut } from "./roomLayout";

export const ROOM_WALL_THICKNESS = .2;
export const ROOM_SKIRTING_DEPTH = .02;
export const ROOM_SKIRTING_HEIGHT = .06;
const samePoint = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z) < .001;
/** Miter outside corners so thick walls form one closed outline without gaps. */
export function wallMiterEnds(room: RoomShape, segment: RoomSegment, segments: RoomSegment[], shared: SharedWallCut[] = []) {
  const atSharedCorner = (point: Point) => shared.some(cut => {
    const wall = cut.wallId;
    const onWall = wall === "north" ? Math.abs(point.z + room.depth / 2) < .001 : wall === "south" ? Math.abs(point.z - room.depth / 2) < .001 : wall === "east" ? Math.abs(point.x - room.width / 2) < .001 : Math.abs(point.x + room.width / 2) < .001;
    const along = wall === "north" ? point.x + room.width / 2 : wall === "south" ? room.width / 2 - point.x : wall === "east" ? point.z + room.depth / 2 : room.depth / 2 - point.z;
    return onWall && along >= cut.from - .001 && along <= cut.to + .001;
  });
  const turn = (a: RoomSegment, b: RoomSegment) => Math.sign((a.b.x - a.a.x) * (b.b.z - b.a.z) - (a.b.z - a.a.z) * (b.b.x - b.a.x));
  const previous = segments.find(s => !s.hole && samePoint(s.b, segment.a));
  const next = segments.find(s => !s.hole && samePoint(s.a, segment.b));
  return {
    start: previous && !atSharedCorner(segment.a) ? Math.max(-segment.length * .45, turn(previous, segment) * ROOM_WALL_THICKNESS) : 0,
    end: next && !atSharedCorner(segment.b) ? Math.max(-segment.length * .45, turn(segment, next) * ROOM_WALL_THICKNESS) : 0,
  };
}
