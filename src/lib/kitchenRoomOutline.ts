import type { KitchenRoom, KitchenSpaceItem, Point2 } from "./kitchenCabinets";

export type RoomOutlinePoint = Point2 & {
  wall: KitchenSpaceItem["wall"];
  curve?: Point2;
};
export function roomOutline(room: KitchenRoom): RoomOutlinePoint[] {
  return (
    room.outline ?? [
      { x: 0, z: 0, wall: "back" },
      { x: room.width, z: 0, wall: "right" },
      { x: room.width, z: room.depth, wall: "front" },
      { x: 0, z: room.depth, wall: "left" },
    ]
  );
}
export function wallPoint(a: RoomOutlinePoint, b: Point2, t: number): Point2 {
  const c = a.curve;
  return c
    ? {
        x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
        z: (1 - t) ** 2 * a.z + 2 * (1 - t) * t * c.z + t * t * b.z,
      }
    : { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
}
export function wallSamples(a: RoomOutlinePoint, b: Point2): Point2[] {
  if (!a.curve) return [a, b];
  const bend = Math.hypot(
    a.curve.x - (a.x + b.x) / 2,
    a.curve.z - (a.z + b.z) / 2,
  );
  const steps = Math.min(128, Math.max(16, Math.ceil(Math.sqrt(bend / 0.5))));
  const ts = Array.from({ length: steps + 1 }, (_, i) => i / steps);
  for (const axis of ["x", "z"] as const) {
    const denominator = a[axis] - 2 * a.curve[axis] + b[axis];
    const t = (a[axis] - a.curve[axis]) / denominator;
    if (Number.isFinite(t) && t > 0 && t < 1) ts.push(t);
  }
  return [...new Set(ts.map((t) => Number(t.toFixed(10))))]
    .sort((a, b) => a - b)
    .map((t) => wallPoint(a, b, t));
}
export function roomBoundary(room: KitchenRoom): RoomOutlinePoint[] {
  const points = roomOutline(room);
  return points.flatMap((p, i) =>
    wallSamples(p, points[(i + 1) % points.length])
      .slice(0, -1)
      .map((q) => ({ ...q, wall: p.wall })),
  );
}
export function wallPath(a: RoomOutlinePoint, b: Point2) {
  return `M${a.x} ${a.z}${a.curve ? `Q${a.curve.x} ${a.curve.z} ${b.x} ${b.z}` : `L${b.x} ${b.z}`}`;
}
export function roomOutlinePath(points: RoomOutlinePoint[]) {
  return (
    points
      .map((p, i) => {
        const next = points[(i + 1) % points.length];
        return `${i === 0 ? `M${p.x} ${p.z}` : ""}${p.curve ? `Q${p.curve.x} ${p.curve.z} ${next.x} ${next.z}` : `L${next.x} ${next.z}`}`;
      })
      .join(" ") + " Z"
  );
}
/** de Casteljau subdivision preserves an existing curve when inserting its midpoint. */
export function splitRoomWall(
  points: RoomOutlinePoint[],
  index: number,
): RoomOutlinePoint[] {
  const next = points.map((p) => ({ ...p })),
    a = next[index],
    b = next[(index + 1) % next.length];
  const middle: RoomOutlinePoint = { ...wallPoint(a, b, 0.5), wall: a.wall };
  if (a.curve) {
    middle.curve = { x: (a.curve.x + b.x) / 2, z: (a.curve.z + b.z) / 2 };
    a.curve = { x: (a.x + a.curve.x) / 2, z: (a.z + a.curve.z) / 2 };
  }
  next.splice(index + 1, 0, middle);
  return next;
}
const cross = (a: Point2, b: Point2, c: Point2) =>
  (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
export function onRoomSegment(p: Point2, a: Point2, b: Point2) {
  return (
    Math.abs(cross(a, b, p)) < 0.001 &&
    p.x >= Math.min(a.x, b.x) - 0.001 &&
    p.x <= Math.max(a.x, b.x) + 0.001 &&
    p.z >= Math.min(a.z, b.z) - 0.001 &&
    p.z <= Math.max(a.z, b.z) + 0.001
  );
}
function intersects(a: Point2, b: Point2, c: Point2, d: Point2) {
  return (
    (cross(a, b, c) * cross(a, b, d) < 0 &&
      cross(c, d, a) * cross(c, d, b) < 0) ||
    onRoomSegment(a, c, d) ||
    onRoomSegment(b, c, d) ||
    onRoomSegment(c, a, b) ||
    onRoomSegment(d, a, b)
  );
}
export function roomArea(points: Point2[]) {
  return (
    points.reduce((sum, p, i) => {
      const q = points[(i + 1) % points.length];
      return sum + p.x * q.z - q.x * p.z;
    }, 0) / 2
  );
}
export function validateRoomOutline(
  room: KitchenRoom,
): RoomOutlinePoint[] | undefined {
  if (room.outline === undefined) return undefined;
  const points = room.outline;
  if (
    !Array.isArray(points) ||
    points.length < 3 ||
    points.length > 40 ||
    points.some(
      (p) =>
        !p ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.z) ||
        p.x < 0 ||
        p.z < 0 ||
        p.x > room.width ||
        p.z > room.depth ||
        !["back", "right", "front", "left"].includes(p.wall) ||
        (p.curve !== undefined &&
          (!p.curve ||
            !Number.isFinite(p.curve.x) ||
            !Number.isFinite(p.curve.z) ||
            p.curve.x < 0 ||
            p.curve.z < 0 ||
            p.curve.x > 8000 ||
            p.curve.z > 8000)),
    )
  )
    throw new Error(
      "Өрөөний хүрээ 3–40 цэгтэй, цэгүүд нь өрөөний хэмжээнд байна.",
    );
  const boundary = roomBoundary(room);
  if (roomArea(boundary) < 1000000)
    throw new Error("Өрөөний талбай 1 м²-ээс багагүй байна.");
  if (
    boundary.some(
      (p) =>
        p.x < 0 ||
        p.z < 0 ||
        p.x > room.width + 0.001 ||
        p.z > room.depth + 0.001,
    )
  )
    throw new Error("Муруй хана өрөөний хэмжээнд багтахгүй байна.");
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    if (Math.hypot(a.x - b.x, a.z - b.z) < 100)
      throw new Error("Ханын цэгүүдийн хооронд 100 мм-ээс багагүй зай байна.");
  }
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i],
      b = boundary[(i + 1) % boundary.length];
    for (let j = i + 1; j < boundary.length; j++) {
      if (j === i + 1 || (i === 0 && j === boundary.length - 1)) continue;
      if (intersects(a, b, boundary[j], boundary[(j + 1) % boundary.length]))
        throw new Error("Өрөөний хананууд хоорондоо огтлолцож болохгүй.");
    }
    const c = boundary[(i + 2) % boundary.length];
    if (
      Math.abs(cross(a, b, c)) < 0.001 &&
      (b.x - a.x) * (c.x - b.x) + (b.z - a.z) * (c.z - b.z) < 0
    )
      throw new Error("Ханын хэсгүүд давхардаж болохгүй.");
  }
  return points.map(({ x, z, wall, curve }) => ({
    x,
    z,
    wall,
    ...(curve ? { curve: { x: curve.x, z: curve.z } } : {}),
  }));
}
export function roomContainsPoint(room: KitchenRoom, p: Point2) {
  const points = roomBoundary(room);
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j],
      b = points[i];
    if (onRoomSegment(p, a, b)) return true;
    if (
      a.z > p.z !== b.z > p.z &&
      p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
}
/** Check every interval cut by the boundary, including concave notches between corners. */
export function roomContainsFootprint(room: KitchenRoom, corners: Point2[]) {
  if (!room.outline)
    return corners.every(
      (p) =>
        p.x >= -0.000001 &&
        p.z >= -0.000001 &&
        p.x <= room.width + 0.000001 &&
        p.z <= room.depth + 0.000001,
    );
  if (!corners.every((p) => roomContainsPoint(room, p))) return false;
  const outline = roomBoundary(room);
  return corners.every((a, i) => {
    const b = corners[(i + 1) % corners.length],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const ts = [0, 1];
    outline.forEach((c, j) => {
      const d = outline[(j + 1) % outline.length],
        ex = d.x - c.x,
        ez = d.z - c.z;
      const det = dx * ez - dz * ex;
      if (Math.abs(det) < 0.000001) return;
      const t = ((c.x - a.x) * ez - (c.z - a.z) * ex) / det;
      const u = ((c.x - a.x) * dz - (c.z - a.z) * dx) / det;
      if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
    });
    ts.sort((x, y) => x - y);
    return ts.slice(1).every((t, j) =>
      roomContainsPoint(room, {
        x: a.x + (dx * (t + ts[j])) / 2,
        z: a.z + (dz * (t + ts[j])) / 2,
      }),
    );
  });
}
export function roomWithOutline(
  room: KitchenRoom,
  outline: RoomOutlinePoint[],
): KitchenRoom {
  const boundary = roomBoundary({ ...room, outline });
  const next = {
    ...room,
    width: Math.ceil(Math.max(2000, ...boundary.map((p) => p.x))),
    depth: Math.ceil(Math.max(2000, ...boundary.map((p) => p.z))),
    outline,
  };
  validateRoomOutline(next);
  return next;
}
