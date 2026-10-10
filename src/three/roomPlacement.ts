import type { DesignRoom, RoomConnection, RoomDesign } from "@/lib/types";
import {
  getRoomGeometry,
  type Bounds,
  type RoomSegment,
} from "@/lib/roomGeometry";
import {
  connectionContact,
  connectionGeometry,
  sharedCutsForSegment,
  roomPosition,
} from "@/lib/roomLayout";
import {
  ceilingPlan,
  ceilingHeightAt,
  ceilingFixtureBounds,
  fixtureBottomHeight,
} from "@/lib/roomCeiling";
import { ROOM_SKIRTING_DEPTH, ROOM_SKIRTING_HEIGHT } from "@/lib/roomRendering";
import { openingWorldTransform } from "@/lib/roomOpenings";
import {
  isInsideRoom,
  isPlacementValid,
  type PlacementRoom,
} from "./collision";

const EPS = 0.00001;
const inside = (x: number, z: number, b: Bounds) =>
  x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;
/** Furniture stays in its owner's coordinates; collision checks span the open floor component. */
export function roomPlacementContext(
  design: RoomDesign,
  roomId = design.activeRoomId,
) {
  const rooms = design.rooms ?? [],
    active = rooms.find((r) => r.id === roomId);
  if (!active) return { room: design as PlacementRoom, pieces: design.pieces };
  const connections = (design.connections ?? []).filter(
    (c) => c.kind === "open" && connectionContact(rooms, c),
  );
  const ids = new Set([active.id]);
  for (let changed = true; changed;) {
    changed = false;
    for (const c of connections)
      if (ids.has(c.roomA) !== ids.has(c.roomB)) {
        ids.add(c.roomA);
        ids.add(c.roomB);
        changed = true;
      }
  }
  const origin = roomPosition(active);
  const floors = rooms
    .filter((r) => ids.has(r.id))
    .map((r) => {
      const g = getRoomGeometry(r),
        p = roomPosition(r),
        dx = p.x - origin.x,
        dz = p.z - origin.z;
      const translate = (b: Bounds) => ({
        minX: b.minX + dx,
        maxX: b.maxX + dx,
        minZ: b.minZ + dz,
        maxZ: b.maxZ + dz,
      });
      const fixtures = (r.lighting?.fixtures ?? []).map((fixture) => ({
        bounds: translate(ceilingFixtureBounds(fixture)),
        height: fixtureBottomHeight(r, fixture),
      }));
      return {
        r,
        g,
        dx,
        dz,
        fixtures,
        ceiling: ceilingPlan(r),
        bounds: translate(g.bounds),
        voids: g.voids.map(translate),
      };
    });
  const occupied = (x: number, z: number) =>
    floors.filter(
      (f) => inside(x, z, f.bounds) && !f.voids.some((v) => inside(x, z, v)),
    );
  const xs = [
    ...new Set(
      floors.flatMap((f) => [
        ...[f.bounds, ...f.voids].flatMap((b) => [b.minX, b.maxX]),
        ...f.ceiling.slabs.flatMap((b) => [b.minX + f.dx, b.maxX + f.dx]),
        ...f.fixtures.flatMap((v) => [v.bounds.minX, v.bounds.maxX]),
      ]),
    ),
  ].sort((a, b) => a - b);
  const zs = [
    ...new Set(
      floors.flatMap((f) => [
        ...[f.bounds, ...f.voids].flatMap((b) => [b.minZ, b.maxZ]),
        ...f.ceiling.slabs.flatMap((b) => [b.minZ + f.dz, b.maxZ + f.dz]),
        ...f.fixtures.flatMap((v) => [v.bounds.minZ, v.bounds.maxZ]),
      ]),
    ),
  ].sort((a, b) => a - b);
  const voids: Bounds[] = [],
    heightZones: Array<Bounds & { height: number }> = [];
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < zs.length; j++) {
      const cell = {
          minX: xs[i - 1],
          maxX: xs[i],
          minZ: zs[j - 1],
          maxZ: zs[j],
        },
        at = occupied((cell.minX + cell.maxX) / 2, (cell.minZ + cell.maxZ) / 2);
      if (at.length)
        heightZones.push({
          ...cell,
          height: Math.min(
            ...at.flatMap((f) => [
              ceilingHeightAt(
                f.r,
                (cell.minX + cell.maxX) / 2 - f.dx,
                (cell.minZ + cell.maxZ) / 2 - f.dz,
              ),
              ...f.fixtures
                .filter((v) =>
                  inside(
                    (cell.minX + cell.maxX) / 2,
                    (cell.minZ + cell.maxZ) / 2,
                    v.bounds,
                  ),
                )
                .map((v) => v.height),
            ]),
          ),
        });
      else voids.push(cell);
    }
  const segments: RoomSegment[] = [],
    skirting: Bounds[] = [];
  for (const f of floors)
    for (const s of f.g.segments) {
      const a = { x: s.a.x + f.dx, z: s.a.z + f.dz },
        b = { x: s.b.x + f.dx, z: s.b.z + f.dz };
      const horizontal = Math.abs(a.z - b.z) < EPS;
      const lo = Math.min(horizontal ? a.x : a.z, horizontal ? b.x : b.z),
        hi = Math.max(horizontal ? a.x : a.z, horizontal ? b.x : b.z);
      let spans = [[lo, hi]];
      for (const c of connections.filter(
        (c) => c.roomA === f.r.id || c.roomB === f.r.id,
      )) {
        const contact = connectionContact(rooms, c)!;
        const ca = { x: contact.a.x - origin.x, z: contact.a.z - origin.z },
          cb = { x: contact.b.x - origin.x, z: contact.b.z - origin.z };
        if (
          Math.abs(horizontal ? ca.z - a.z : ca.x - a.x) > EPS ||
          Math.abs(horizontal ? cb.z - a.z : cb.x - a.x) > EPS
        )
          continue;
        const from = Math.min(
            horizontal ? ca.x : ca.z,
            horizontal ? cb.x : cb.z,
          ),
          to = Math.max(horizontal ? ca.x : ca.z, horizontal ? cb.x : cb.z);
        spans = spans.flatMap(([start, end]) =>
          to <= start || from >= end
            ? [[start, end]]
            : [
                [start, Math.max(start, from)],
                [Math.min(end, to), end],
              ].filter(([x, y]) => y - x > EPS),
        );
      }
      let boardSpans = spans.map((span) => [...span]);
      const cutBoard = (from: number, to: number) => {
        boardSpans = boardSpans.flatMap(([start, end]) =>
          to <= start || from >= end
            ? [[start, end]]
            : [
                [start, Math.max(start, from)],
                [Math.min(end, to), end],
              ].filter(([x, y]) => y - x > EPS),
        );
      };
      const shared = connectionGeometry(f.r, rooms, design.connections ?? []);
      for (const cut of sharedCutsForSegment(f.r, s, shared.cuts).filter(
        (c) => c.sillHeight < ROOM_SKIRTING_HEIGHT,
      )) {
        const direction = horizontal
          ? (s.b.x - s.a.x) / s.length
          : (s.b.z - s.a.z) / s.length;
        const centre = (lo + hi) / 2 + cut.x * direction;
        cutBoard(centre - cut.width / 2, centre + cut.width / 2);
      }
      for (const opening of shared.visibleOpenings.filter(
        (o) => o.sillHeight < ROOM_SKIRTING_HEIGHT,
      )) {
        const p = openingWorldTransform(f.r, opening),
          x = p.x + f.dx,
          z = p.z + f.dz;
        if (Math.abs(horizontal ? z - a.z : x - a.x) > EPS) continue;
        const centre = horizontal ? x : z;
        cutBoard(centre - opening.width / 2, centre + opening.width / 2);
      }
      for (const [start, end] of boardSpans) {
        skirting.push(
          horizontal
            ? {
                minX: start,
                maxX: end,
                minZ: Math.min(a.z, a.z + s.nz * ROOM_SKIRTING_DEPTH),
                maxZ: Math.max(a.z, a.z + s.nz * ROOM_SKIRTING_DEPTH),
              }
            : {
                minX: Math.min(a.x, a.x + s.nx * ROOM_SKIRTING_DEPTH),
                maxX: Math.max(a.x, a.x + s.nx * ROOM_SKIRTING_DEPTH),
                minZ: start,
                maxZ: end,
              },
        );
      }
      for (const [start, end] of spans) {
        const sa = horizontal ? { x: start, z: a.z } : { x: a.x, z: start },
          sb = horizontal ? { x: end, z: a.z } : { x: a.x, z: end };
        segments.push({ ...s, a: sa, b: sb, length: end - start });
        // A closed shared wall can remain inside a component connected through a third room.
        const x = (sa.x + sb.x) / 2,
          z = (sa.z + sb.z) / 2;
        if (
          occupied(x + s.nx * 0.01, z + s.nz * 0.01).length &&
          occupied(x - s.nx * 0.01, z - s.nz * 0.01).length
        ) {
          voids.push(
            horizontal
              ? { minX: start, maxX: end, minZ: z - EPS, maxZ: z + EPS }
              : { minX: x - EPS, maxX: x + EPS, minZ: start, maxZ: end },
          );
        }
      }
    }
  const room: PlacementRoom = {
    ...active,
    heightZones,
    skirting,
    placementGeometry: {
      bounds: { minX: xs[0], maxX: xs.at(-1)!, minZ: zs[0], maxZ: zs.at(-1)! },
      voids,
      segments,
      connected: true,
      simple: true,
    },
  };
  const pieces = floors.flatMap((f) =>
    f.r.pieces.map((p) => ({ ...p, x: p.x + f.dx, z: p.z + f.dz })),
  );
  return { room, pieces };
}

export const SEAM_FURNITURE_NOTICE =
  "Залгаас дээр тавилга байна. Өрөөг салгах эсвэл хаалга нэмэхийн өмнө тавилгыг эхлээд зөөнө үү.";
/** Reject layout changes only when they invalidate an existing footprint. */
export function layoutFurnitureIssue(
  before: RoomDesign,
  rooms: DesignRoom[],
  connections: RoomConnection[],
): string | null {
  const next = { ...before, rooms, connections };
  for (const owner of before.rooms ?? []) {
    const oldContext = roomPlacementContext(before, owner.id),
      context = roomPlacementContext(next, owner.id);
    for (const piece of owner.pieces)
      if (
        isInsideRoom(piece, oldContext.room) &&
        !isInsideRoom(piece, context.room)
      )
        return SEAM_FURNITURE_NOTICE;
  }
  return null;
}

/** Detect new vertical/skirting conflicts for every owner, including pieces across an open seam. */
export function layoutClearanceIssue(
  before: RoomDesign,
  next: RoomDesign,
): boolean {
  for (const owner of before.rooms ?? []) {
    const oldContext = roomPlacementContext(before, owner.id),
      context = roomPlacementContext(next, owner.id);
    const updated = next.rooms?.find((room) => room.id === owner.id);
    for (const piece of owner.pieces) {
      const candidate = updated?.pieces.find(
        (p) => p.instanceId === piece.instanceId,
      );
      if (
        candidate &&
        isPlacementValid(piece, [], oldContext.room) &&
        !isPlacementValid(candidate, [], context.room)
      )
        return true;
    }
  }
  return false;
}
