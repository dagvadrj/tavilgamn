import { applianceIssue } from "./plitka";
import { roomWalls, type CabinetPose, type Countertop, type KitchenWall, type ModularCabinet, type ModularKitchen, type Point2 } from "./kitchenCabinets";

const EPS = 0.000001; // Numerical tolerance only (one nanometre in mm coordinates).
export const WALL_SNAP_MM = 120;
export const ADJACENT_SNAP_MM = 100;
const dot = (a: Point2, b: Point2) => a.x * b.x + a.z * b.z;
const sub = (a: Point2, b: Point2): Point2 => ({ x: a.x - b.x, z: a.z - b.z });
const cleanAxis = (value: number) => Math.abs(value) < 1e-12 ? 0 : Math.abs(Math.abs(value) - 1) < 1e-12 ? Math.sign(value) : value;
export const cabinetAxes = (rotation: number) => {
  const sin = cleanAxis(Math.sin(rotation)), cos = cleanAxis(Math.cos(rotation));
  return { right: { x: cos, z: -sin }, front: { x: sin, z: cos } };
};
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
    if (other.id === cabinet.id || (cabinet.type === "wall") !== (other.type === "wall")) continue;
    if (Math.abs(other.position.y - position.y) > 150) continue;
    const local = sub(position, other.position);
    const along = dot(local, right), backOffset = (cabinet.depth - other.depth) / 2;
    const options: CabinetPose[] = [];
    if (aligned(candidate, other) && Math.abs(dot(local, front) - backOffset) <= WALL_SNAP_MM) {
      for (const sign of [-1, 1]) {
        const target = sign * (cabinet.width + other.width) / 2;
        if (Math.abs(along - target) <= ADJACENT_SNAP_MM) options.push({ ...position,
          x: other.position.x + right.x * target + front.x * backOffset,
          z: other.position.z + right.z * target + front.z * backOffset });
      }
    }
    // Orthogonal runs must also attract: a return meets the end/front edge of
    // the corner unit. Keep the chosen wall and solve the shared edge exactly.
    const otherAxes = cabinetAxes(other.position.rotation);
    const parallel = Math.abs(dot(right, otherAxes.right));
    if (!aligned(candidate, other) && (parallel < EPS || Math.abs(parallel - 1) < EPS)) {
      const projected = (axis: Point2) => (Math.abs(dot(axis, otherAxes.right)) * other.width + Math.abs(dot(axis, otherAxes.front)) * other.depth) / 2;
      for (const [axis, tangent, half, tangentHalf] of [[right, front, cabinet.width / 2, cabinet.depth / 2], [front, right, cabinet.depth / 2, cabinet.width / 2]] as const) {
        if (snappedWall && axis === front) continue;
        const normal = dot(local, axis), tangentPosition = dot(local, tangent);
        const otherHalf = projected(axis), otherTangentHalf = projected(tangent);
        for (const sign of [-1, 1]) {
          const target = sign * (half + otherHalf);
          if (Math.abs(normal - target) > ADJACENT_SNAP_MM) continue;
          const tangents = snappedWall ? [tangentPosition] : [tangentPosition, 0, otherTangentHalf - tangentHalf, tangentHalf - otherTangentHalf];
          for (const offset of tangents) {
            if (Math.abs(offset) >= tangentHalf + otherTangentHalf - EPS || Math.abs(offset - tangentPosition) > ADJACENT_SNAP_MM) continue;
            options.push({ ...position, x: other.position.x + axis.x * target + tangent.x * offset,
              z: other.position.z + axis.z * target + tangent.z * offset });
          }
        }
      }
    }
    for (const next of options) {
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
export interface PlacementIssue { code: "appliance" | "overlap" | "outside" | "ceiling" | "wall" | "clearance"; ids: string[]; message: string; severity: "error" | "warning" }
export function placementIssues(kitchen: ModularKitchen): PlacementIssue[] {
  const issues: PlacementIssue[] = [], walls = roomWalls(kitchen.room);
  for (const [index, cabinet] of kitchen.cabinets.entries()) {
    const invalidAppliance = applianceIssue(cabinet);
    if (invalidAppliance) issues.push({ code: "appliance", ids: [cabinet.id], message: invalidAppliance, severity: "error" });
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

/** Subtract an orthogonal rectangular board; the resulting butt joints share
 * exact edges. This prevents double material at the inside of an L return. */
function subtractBoard<T extends { id: string; width: number; depth: number; position: CabinetPose }>(board: T, blocker: T): T[] {
  const { right, front } = cabinetAxes(board.position.rotation), blockerAxes = cabinetAxes(blocker.position.rotation);
  const alignment = Math.abs(dot(right, blockerAxes.right));
  if (alignment > EPS && Math.abs(alignment - 1) > EPS) return [board];
  const delta = sub(blocker.position, board.position);
  const extentX = (Math.abs(dot(right, blockerAxes.right)) * blocker.width + Math.abs(dot(right, blockerAxes.front)) * blocker.depth) / 2;
  const extentZ = (Math.abs(dot(front, blockerAxes.right)) * blocker.width + Math.abs(dot(front, blockerAxes.front)) * blocker.depth) / 2;
  const left = -board.width / 2, rightEdge = board.width / 2, back = -board.depth / 2, face = board.depth / 2;
  const x1 = Math.max(left, dot(delta, right) - extentX), x2 = Math.min(rightEdge, dot(delta, right) + extentX);
  const z1 = Math.max(back, dot(delta, front) - extentZ), z2 = Math.min(face, dot(delta, front) + extentZ);
  if (x2 - x1 <= EPS || z2 - z1 <= EPS) return [board];
  return [[left, x1, back, face], [x2, rightEdge, back, face], [x1, x2, back, z1], [x1, x2, z2, face]]
    .filter(([minX, maxX, minZ, maxZ]) => maxX - minX > EPS && maxZ - minZ > EPS)
    .map(([minX, maxX, minZ, maxZ], index) => ({ ...board, id: `${board.id}:joint-${index}`, width: maxX - minX, depth: maxZ - minZ,
      position: { ...board.position, x: board.position.x + right.x * (minX + maxX) / 2 + front.x * (minZ + maxZ) / 2,
        z: board.position.z + right.z * (minX + maxX) / 2 + front.z * (minZ + maxZ) / 2 } }));
}
/** One board per contiguous straight run. At corners the first run owns the
 * shared material; the returning board is trimmed to an exact butt joint. */
export function fitCountertops(kitchen: ModularKitchen): Countertop[] {
  const surface = (c: ModularCabinet) => {
    const component = c.components?.find(item => item.type === "worktop");
    return { finish: ((component?.finish ?? component?.model) as Countertop["finish"]) ?? kitchen.countertop.finish, color: component?.color };
  };
  const remaining = new Set(kitchen.cabinets.filter(c => c.type === "base"));
  const tops: Countertop[] = [];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    const { right, front } = cabinetAxes(first.position.rotation);
    const group = [first]; remaining.delete(first);
    for (let i = 0; i < group.length; i++) for (const other of remaining) {
      const member = group[i], delta = sub(other.position, member.position);
      if (JSON.stringify(surface(member)) === JSON.stringify(surface(other)) && aligned(member, other) && Math.abs(member.height - other.height) < EPS && Math.abs(member.position.y - other.position.y) < EPS &&
          Math.abs(member.depth - other.depth) < EPS && Math.abs(dot(delta, front)) < EPS &&
          Math.abs(Math.abs(dot(delta, right)) - (member.width + other.width) / 2) < EPS) {
        group.push(other); remaining.delete(other);
      }
    }
    const width = group.reduce((sum, item) => sum + item.width, 0);
    const left = Math.min(...group.map(item => dot(sub(item.position, first.position), right) - item.width / 2));
    const centre = left + width / 2, overhang = kitchen.countertop.frontOverhang;
    tops.push({ ...kitchen.countertop, ...surface(first), id: `top:${group.map(c => c.id).sort().join(":")}`, cabinetIds: group.map(c => c.id), width,
      depth: first.depth + overhang,
      position: { x: first.position.x + right.x * centre + front.x * overhang / 2,
        z: first.position.z + right.z * centre + front.z * overhang / 2,
        y: first.position.y + first.height, rotation: first.position.rotation } });
  }
  const fitted: Countertop[] = [];
  // Horizontal wall runs own the corner, regardless of cabinet insertion order.
  tops.sort((a, b) => Math.abs(Math.sin(a.position.rotation)) - Math.abs(Math.sin(b.position.rotation)) || a.id.localeCompare(b.id));
  for (const top of tops) {
    let pieces = [top];
    for (const prior of fitted) if (Math.abs(prior.position.y - top.position.y) < EPS)
      pieces = pieces.flatMap(piece => subtractBoard(piece, prior));
    fitted.push(...pieces);
  }
  return fitted;
}

export interface PlinthRun {
  id: string; cabinetIds: string[]; width: number; depth: number; height: number;
  position: CabinetPose; color: string; finish: Countertop["finish"];
}
/** Continuous 18 mm kickboard, 80 mm high, recessed 70 mm from the fronts.
 * Perpendicular runs form a butt joint instead of overlapping full blocks. */
export function fitPlinths(kitchen: ModularKitchen): PlinthRun[] {
  const bases = kitchen.cabinets.filter(c => c.type === "base" && c.components?.find(p => p.type === "plinth")?.model !== "legs");
  const plinth = (c: ModularCabinet) => c.components?.find(p => p.type === "plinth");
  const remaining = new Set(bases), runs: PlinthRun[] = [];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    const { right, front } = cabinetAxes(first.position.rotation);
    const color = plinth(first)?.color ?? "#5c6057", finish = (plinth(first)?.finish as Countertop["finish"]) ?? "matte";
    const group = [first]; remaining.delete(first);
    for (let i = 0; i < group.length; i++) for (const other of remaining) {
      const member = group[i], delta = sub(other.position, member.position);
      if (aligned(member, other) && Math.abs(member.depth - other.depth) < EPS && Math.abs(member.position.y - other.position.y) < EPS &&
          (plinth(other)?.color ?? "#5c6057") === color && (plinth(other)?.finish ?? "matte") === finish &&
          Math.abs(dot(delta, front)) < EPS && Math.abs(Math.abs(dot(delta, right)) - (member.width + other.width) / 2) < EPS) {
        group.push(other); remaining.delete(other);
      }
    }
    const width = group.reduce((sum, c) => sum + c.width, 0);
    const left = Math.min(...group.map(c => dot(sub(c.position, first.position), right) - c.width / 2)), centre = left + width / 2;
    const forward = first.depth / 2 - 79;
    runs.push({ id: `plinth:${group.map(c => c.id).sort().join(":")}`, cabinetIds: group.map(c => c.id), width, depth: 18, height: 80, color, finish,
      position: { ...first.position, x: first.position.x + right.x * centre + front.x * forward,
        z: first.position.z + right.z * centre + front.z * forward } });
  }
  runs.sort((a, b) => Math.abs(Math.sin(a.position.rotation)) - Math.abs(Math.sin(b.position.rotation)) || a.id.localeCompare(b.id));
  for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
    const a = runs[i], b = runs[j], axesA = cabinetAxes(a.position.rotation), axesB = cabinetAxes(b.position.rotation);
    if (Math.abs(dot(axesA.right, axesB.right)) > EPS || Math.abs(a.position.y - b.position.y) > EPS) continue;
    const groupA = bases.filter(c => a.cabinetIds.includes(c.id)), groupB = bases.filter(c => b.cabinetIds.includes(c.id));
    // Only join actual touching cabinet runs, not unrelated facing islands.
    const connected = groupA.some(c => groupB.some(d => {
      const delta = sub(d.position, c.position), projected = (Math.abs(dot(axesA.right, axesB.right)) * d.width + Math.abs(dot(axesA.right, axesB.front)) * d.depth) / 2;
      const otherDepth = (Math.abs(dot(axesA.front, axesB.right)) * d.width + Math.abs(dot(axesA.front, axesB.front)) * d.depth) / 2;
      return Math.abs(dot(delta, axesA.right)) <= c.width / 2 + projected + EPS && Math.abs(dot(delta, axesA.front)) <= c.depth / 2 + otherDepth + EPS;
    }));
    if (!connected) continue;
    const delta = sub(b.position, a.position), ta = dot(delta, axesA.right), tb = -dot(delta, axesB.right);
    const adjustEnd = (run: PlinthRun, axis: Point2, at: number, extension: number) => {
      const sign = at < 0 ? -1 : 1, fixed = -sign * run.width / 2, end = at + sign * extension;
      if (sign * (end - fixed) <= EPS) return;
      const centre = (fixed + end) / 2;
      run.width = Math.abs(end - fixed);
      run.position = { ...run.position, x: run.position.x + axis.x * centre, z: run.position.z + axis.z * centre };
    };
    // First fascia passes the centreline by half a board; second stops short.
    adjustEnd(a, axesA.right, ta, b.depth / 2);
    adjustEnd(b, axesB.right, tb, -a.depth / 2);
  }
  const fitted: PlinthRun[] = [];
  for (const run of runs) {
    let pieces = [run];
    for (const prior of fitted) if (Math.abs(prior.position.y - run.position.y) < EPS) pieces = pieces.flatMap(piece => subtractBoard(piece, prior));
    fitted.push(...pieces);
  }
  return fitted;
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
    // Try real edges, including user-entered appliance widths. A 100 mm grid
    // left unwanted gaps after, for example, a 750 mm refrigerator.
    const starts = new Set([cabinet.width / 2, length - cabinet.width / 2]);
    for (const other of kitchen.cabinets) {
      const extent = cabinetCorners(other).map(p => dot(sub(p, wall.start), tangent));
      starts.add(Math.min(...extent) - cabinet.width / 2);
      starts.add(Math.max(...extent) + cabinet.width / 2);
    }
    for (const along of [...starts].sort((a, b) => a - b)) {
      if (along < cabinet.width / 2 - EPS || along > length - cabinet.width / 2 + EPS) continue;
      const pose = { ...cabinet.position, rotation: Math.atan2(wall.inward.x, wall.inward.z),
        x: wall.start.x + tangent.x * along + wall.inward.x * cabinet.depth / 2,
        z: wall.start.z + tangent.z * along + wall.inward.z * cabinet.depth / 2 };
      const next = resolveElevations({ ...kitchen, cabinets: [...kitchen.cabinets, { ...cabinet, position: pose }] });
      if (!placementIssues(next).some(issue => issue.severity === "error")) return next;
    }
  }
  return null;
}
