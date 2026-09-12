import { roomWalls, type CabinetPose, type Countertop, type KitchenWall, type ModularCabinet, type ModularKitchen, type Point2 } from "./kitchenCabinets";

const EPS = 0.01; // Contact is allowed; positive penetration over 0.01 mm is not.
export const WALL_SNAP_MM = 120;
export const ADJACENT_SNAP_MM = 100;
const dot = (a: Point2, b: Point2) => a.x * b.x + a.z * b.z;
const sub = (a: Point2, b: Point2): Point2 => ({ x: a.x - b.x, z: a.z - b.z });
export const cabinetAxes = (rotation: number) => ({ right: { x: Math.cos(rotation), z: -Math.sin(rotation) }, front: { x: Math.sin(rotation), z: Math.cos(rotation) } });
const aligned = (a: ModularCabinet, b: ModularCabinet) => Math.cos(a.position.rotation - b.position.rotation) > 1 - 1e-8;
export function cabinetCorners(cabinet: ModularCabinet): Point2[] {
  const { right, front } = cabinetAxes(cabinet.position.rotation);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => ({
    x: cabinet.position.x + x * right.x * cabinet.width / 2 + z * front.x * cabinet.depth / 2,
    z: cabinet.position.z + x * right.z * cabinet.width / 2 + z * front.z * cabinet.depth / 2,
  }));
}
/** Separating axis test for rotated footprints. A shared edge is not overlap. */
export function footprintsOverlap(a: ModularCabinet, b: ModularCabinet): boolean {
  const cornersA = cabinetCorners(a), cornersB = cabinetCorners(b);
  const axesA = cabinetAxes(a.position.rotation), axesB = cabinetAxes(b.position.rotation);
  return [axesA.right, axesA.front, axesB.right, axesB.front].every(axis => {
    const ap = cornersA.map(p => dot(p, axis)), bp = cornersB.map(p => dot(p, axis));
    return Math.min(Math.max(...ap), Math.max(...bp)) - Math.max(Math.min(...ap), Math.min(...bp)) > EPS;
  });
}
export function cabinetsOverlap(a: ModularCabinet, b: ModularCabinet): boolean {
  return Math.min(a.position.y + a.height, b.position.y + b.height) - Math.max(a.position.y, b.position.y) > EPS && footprintsOverlap(a, b);
}
function wallFrame(wall: KitchenWall) {
  const delta = sub(wall.end, wall.start), length = Math.hypot(delta.x, delta.z);
  return { tangent: { x: delta.x / length, z: delta.z / length }, length };
}
function touchesWall(cabinet: ModularCabinet, wall: KitchenWall): boolean {
  const { tangent, length } = wallFrame(wall);
  if (!length) return false;
  const local = sub(cabinet.position, wall.start), along = dot(local, tangent);
  return dot(cabinetAxes(cabinet.position.rotation).front, wall.inward) > 1 - 1e-8 &&
    Math.abs(dot(local, wall.inward) - cabinet.depth / 2) <= EPS && along >= cabinet.width / 2 - EPS && along <= length - cabinet.width / 2 + EPS;
}
export function snapCabinet(cabinet: ModularCabinet, requested: CabinetPose, others: ModularCabinet[], walls: KitchenWall[]) {
  let position = { ...requested };
  let snappedWall: KitchenWall | undefined;
  let best = Infinity;
  for (const wall of walls) {
    const { tangent, length } = wallFrame(wall);
    if (!length || length < cabinet.width) continue;
    const local = sub(requested, wall.start), distance = dot(local, wall.inward);
    if (distance < -EPS || Math.abs(distance - cabinet.depth / 2) > WALL_SNAP_MM) continue;
    const rawAlong = dot(local, tangent);
    const along = Math.max(cabinet.width / 2, Math.min(length - cabinet.width / 2, rawAlong));
    if (Math.abs(along - rawAlong) > WALL_SNAP_MM) continue;
    const rotation = Math.atan2(wall.inward.x, wall.inward.z);
    const score = Math.hypot(along - rawAlong, distance - cabinet.depth / 2) + (1 - Math.cos(rotation - requested.rotation)) * 5;
    if (score >= best) continue;
    best = score; snappedWall = wall;
    position = { ...requested, rotation,
      x: wall.start.x + tangent.x * along + wall.inward.x * cabinet.depth / 2,
      z: wall.start.z + tangent.z * along + wall.inward.z * cabinet.depth / 2 };
  }
  const candidate = { ...cabinet, position };
  const { right, front } = cabinetAxes(position.rotation);
  let neighbourId: string | undefined;
  let adjacent = position;
  best = Infinity;
  for (const other of others) {
    if (other.id === cabinet.id || !aligned(candidate, other) || (cabinet.type === "wall") !== (other.type === "wall")) continue;
    if (Math.abs(other.position.y - position.y) > 150) continue;
    if (snappedWall && !touchesWall(other, snappedWall)) continue;
    const local = sub(position, other.position);
    const along = dot(local, right), backOffset = (cabinet.depth - other.depth) / 2;
    if (Math.abs(dot(local, front) - backOffset) > WALL_SNAP_MM) continue;
    for (const sign of [-1, 1]) {
      const target = sign * (cabinet.width + other.width) / 2;
      if (Math.abs(along - target) > ADJACENT_SNAP_MM) continue;
      const next = { ...position, x: other.position.x + right.x * target + front.x * backOffset,
        z: other.position.z + right.z * target + front.z * backOffset };
      const proposed = { ...cabinet, position: next };
      if (snappedWall && !touchesWall(proposed, snappedWall)) continue;
      if (others.some(item => item.id !== cabinet.id && cabinetsOverlap(proposed, item))) continue;
      const distance = Math.hypot(next.x - position.x, next.z - position.z);
      if (distance < best) { best = distance; adjacent = next; neighbourId = other.id; }
    }
  }
  return { position: adjacent, wallId: snappedWall?.id, neighbourId };
}

export function resolveElevations(kitchen: ModularKitchen): ModularKitchen {
  const bases = kitchen.cabinets.filter(c => c.type === "base");
  return { ...kitchen, cabinets: kitchen.cabinets.map(cabinet => {
    if (cabinet.type === "tall") return { ...cabinet, height: cabinet.fitToCeiling ? kitchen.room.height : cabinet.height, position: { ...cabinet.position, y: 0 } };
    if (cabinet.type === "base") return { ...cabinet, position: { ...cabinet.position, y: 0 } };
    if (!cabinet.autoElevation) return cabinet;
    const below = bases.filter(base => footprintsOverlap(cabinet, base));
    const top = below.length ? Math.max(...below.map(base => base.height + base.position.y)) : 820;
    return { ...cabinet, position: { ...cabinet.position, y: top + kitchen.countertop.thickness + kitchen.wallClearance } };
  }) };
}
export function wallCabinetClearance(cabinet: ModularCabinet, kitchen: ModularKitchen): number | null {
  const below = kitchen.cabinets.filter(base => base.type === "base" && footprintsOverlap(cabinet, base));
  return cabinet.type === "wall" && below.length ? cabinet.position.y - Math.max(...below.map(base => base.position.y + base.height + kitchen.countertop.thickness)) : null;
}
export interface PlacementIssue { code: "overlap" | "outside" | "ceiling" | "wall" | "clearance"; ids: string[]; message: string; severity: "error" | "warning" }
export function placementIssues(kitchen: ModularKitchen): PlacementIssue[] {
  const issues: PlacementIssue[] = [], walls = roomWalls(kitchen.room);
  for (const [index, cabinet] of kitchen.cabinets.entries()) {
    if (cabinetCorners(cabinet).some(p => p.x < -EPS || p.z < -EPS || p.x > kitchen.room.width + EPS || p.z > kitchen.room.depth + EPS))
      issues.push({ code: "outside", ids: [cabinet.id], message: "Шүүгээ өрөөний хилээс гарсан байна.", severity: "error" });
    if (cabinet.position.y < 0 || cabinet.position.y + cabinet.height + (cabinet.type === "base" ? kitchen.countertop.thickness : 0) > kitchen.room.height + EPS)
      issues.push({ code: "ceiling", ids: [cabinet.id], message: "Шүүгээ шал эсвэл таазны хязгаараас гарсан байна.", severity: "error" });
    if (cabinet.type === "wall" && !walls.some(wall => touchesWall(cabinet, wall)))
      issues.push({ code: "wall", ids: [cabinet.id], message: "Дээд шүүгээг хананд наалдуулж байрлуулна уу.", severity: "error" });
    const clearance = wallCabinetClearance(cabinet, kitchen);
    if (clearance !== null && (clearance < 450 - EPS || clearance > 600 + EPS))
      issues.push({ code: "clearance", ids: [cabinet.id], message: `Тавцангаас дээд шүүгээ хүртэл ${Math.round(clearance)} мм; тохируулах зай 450–600 мм.`, severity: clearance < 450 ? "error" : "warning" });
    for (const other of kitchen.cabinets.slice(index + 1)) if (cabinetsOverlap(cabinet, other))
      issues.push({ code: "overlap", ids: [cabinet.id, other.id], message: "Шүүгээнүүд давхцаж байна.", severity: "error" });
  }
  return issues;
}

/** One top per contiguous straight run. Gaps, turns, depth or height changes split tops.
 * Width is the sum of member widths; overhang extends only the front edge.
 */
export function fitCountertops(kitchen: ModularKitchen): Countertop[] {
  const remaining = new Set(kitchen.cabinets.filter(c => c.type === "base"));
  const tops: Countertop[] = [];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    const { right, front } = cabinetAxes(first.position.rotation);
    const group = [first]; remaining.delete(first);
    for (let i = 0; i < group.length; i++) for (const other of remaining) {
      const member = group[i], delta = sub(other.position, member.position);
      if (aligned(member, other) && Math.abs(member.height - other.height) < EPS && Math.abs(member.position.y - other.position.y) < EPS &&
          Math.abs(member.depth - other.depth) < EPS && Math.abs(dot(delta, front)) < EPS &&
          Math.abs(Math.abs(dot(delta, right)) - (member.width + other.width) / 2) < EPS) {
        group.push(other); remaining.delete(other);
      }
    }
    const width = group.reduce((sum, item) => sum + item.width, 0);
    const left = Math.min(...group.map(item => dot(sub(item.position, first.position), right) - item.width / 2));
    const centre = left + width / 2, overhang = kitchen.countertop.frontOverhang;
    tops.push({ ...kitchen.countertop, id: `top:${group.map(c => c.id).sort().join(":")}`, cabinetIds: group.map(c => c.id), width,
      depth: first.depth + overhang,
      position: { x: first.position.x + right.x * centre + front.x * overhang / 2,
        z: first.position.z + right.z * centre + front.z * overhang / 2,
        y: first.position.y + first.height, rotation: first.position.rotation } });
  }
  return tops;
}
export function proposeCabinetMove(kitchen: ModularKitchen, id: string, requested: CabinetPose) {
  const cabinet = kitchen.cabinets.find(c => c.id === id);
  if (!cabinet) return { kitchen, issues: placementIssues(kitchen), wallId: undefined, neighbourId: undefined };
  const snap = snapCabinet(cabinet, requested, kitchen.cabinets, roomWalls(kitchen.room));
  const next = resolveElevations({ ...kitchen, cabinets: kitchen.cabinets.map(c => c.id === id ? { ...c, position: snap.position } : c) });
  return { kitchen: next, issues: placementIssues(next), wallId: snap.wallId, neighbourId: snap.neighbourId };
}
/** Deterministic first free wall position; never adds a module on top of another. */
export function findCabinetSpace(kitchen: ModularKitchen, cabinet: ModularCabinet): ModularKitchen | null {
  for (const wall of roomWalls(kitchen.room)) {
    const { tangent, length } = wallFrame(wall);
    for (let along = cabinet.width / 2; along <= length - cabinet.width / 2; along += 100) {
      const pose = { ...cabinet.position, rotation: Math.atan2(wall.inward.x, wall.inward.z),
        x: wall.start.x + tangent.x * along + wall.inward.x * cabinet.depth / 2,
        z: wall.start.z + tangent.z * along + wall.inward.z * cabinet.depth / 2 };
      const next = resolveElevations({ ...kitchen, cabinets: [...kitchen.cabinets, { ...cabinet, position: pose }] });
      if (!placementIssues(next).some(issue => issue.severity === "error")) return next;
    }
  }
  return null;
}
