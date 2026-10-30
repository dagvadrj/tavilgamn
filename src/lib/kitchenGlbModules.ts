/**
 * Cabinet detection for a full-kitchen GLB that has no cabinet-level grouping
 * (CAD/SketchUp exports are usually loose 16–18 mm boards). Doors and drawer
 * fronts of one run share a vertical plane; the distinct horizontal spans of
 * those fronts are the modules. Worktops and splash-backs are thin slabs.
 * Units: millimetres, Y up, origin bottom-centre (after preparation).
 */
import {
  CABINET_DEFAULTS,
  REFRIGERATOR_LIMITS,
  cabinetWidths,
  createCabinet,
  createHood,
  createModularKitchen,
  createRefrigerator,
  type ModularKitchen,
} from "./kitchenCabinets";
import { parseKitchen } from "./kitchenAssembly";
import {
  detectKitchenGlbAppliances,
  kitchenGlbGrowCabinet,
  kitchenGlbUnion,
  type KitchenGlbAppliance,
} from "./kitchenGlbCarcass";

// Appliance words: such a solid is a fridge/oven/…, never a cabinet box.
const APPLIANCE_WORDS =
  /sink|мойк|угаалтуур|faucet|\btap\b|mixer|cooker|cooktop|\bhob\b|induction|плит|hood|вытяж|сорогч|micro ?wave|oven|духов|шарах|fridge|refrigerator|хөргөгч|dish ?washer/i;

export type KitchenGlbBox = {
  min: [number, number, number];
  max: [number, number, number];
};
export type KitchenGlbPart = {
  id: number;
  name: string;
  materials: string[];
  box: KitchenGlbBox;
  /** Shell thickness from the mesh (2·volume / area); set for closed meshes. */
  thicknessMm?: number;
  /** Surface area of the mesh, mm² (developed size of bent panels). */
  areaMm2?: number;
};
export type KitchenGlbModuleRole = "base" | "wall" | "tall";
export type KitchenGlbModule = {
  id: string;
  role: KitchenGlbModuleRole;
  name: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  box: KitchenGlbBox;
  /** Part ids (fronts and any part the merchant attached by clicking). */
  parts: number[];
  /** Direction the fronts face (towards the room): +z, -z, +x or -x. */
  facing: KitchenGlbFacing;
  manual?: boolean;
  /** Front finish read from the GLB material (hex); the merchant may override it. */
  color?: string;
  finish?: KitchenGlbFinish;
  /** How each size was measured; "estimated" sizes must be checked by hand. */
  measured?: KitchenGlbMeasured;
  /** The merchant re-checked this module's sizes against the drawing. */
  checked?: boolean;
};
export type KitchenGlbMeasureSource =
  | "carcass"
  | "front"
  | "solid"
  | "estimated"
  | "merged"
  | "manual";
export type KitchenGlbMeasured = Record<
  "width" | "height" | "depth",
  KitchenGlbMeasureSource
>;
/** Surface of one GLB material, read during preparation. */
export type KitchenGlbMaterial = {
  color: string;
  roughness: number;
  metalness: number;
  textured: boolean;
};
export type KitchenGlbFinish = "matte" | "gloss" | "wood";
export type KitchenGlbFacing = "+z" | "-z" | "+x" | "-x";
export type KitchenGlbDetection = {
  /** Worktop parts and their dominant surface. */
  countertopParts?: number[];
  countertopColor?: string;
  countertopKind?: "laminate" | "granite" | "wood";
  modules: KitchenGlbModule[];
  /** Sinks, hobs, hoods, fridges … found by name or by size (BOM + planner). */
  appliances?: KitchenGlbAppliance[];
  fronts: number;
  countertopM2: number;
  backsplashM2: number;
};

export const KITCHEN_GLB_ROLE_LABELS: Record<KitchenGlbModuleRole, string> = {
  base: "Доод шүүгээ",
  wall: "Дээд шүүгээ",
  tall: "Өндөр шүүгээ",
};

const BOARD = 25; // thickest door / panel
const size = (box: KitchenGlbBox) =>
  box.max.map((value, axis) => value - box.min[axis]) as [
    number,
    number,
    number,
  ];
const round = (value: number) => Math.round(value);
/** A bent / rounded panel: thin shell whose bounding box is not thin. */
export function kitchenGlbCurved(part: KitchenGlbPart) {
  if (part.thicknessMm === undefined || part.thicknessMm > 30) return false;
  const [w, h, d] = size(part.box);
  if (Math.min(w, h, d) <= 40 || Math.max(w, h, d) < 300) return false;
  // One bent sheet unrolls to at most the two box sides it spans times its
  // height; a mesh holding a whole carcass (many boards) has far more surface.
  const face = (part.areaMm2 ?? Infinity) / 2;
  return face <= 1.15 * Math.max((w + d) * h, (w + h) * d, (h + d) * w);
}

export function kitchenGlbRoleOf(
  bottom: number,
  top: number,
): KitchenGlbModuleRole | null {
  if (bottom < 600 && top > 1700) return "tall";
  if (top <= 1050) return "base";
  if (bottom >= 1150) return "wall";
  return null;
}

const DEPTH: Record<KitchenGlbModuleRole, number> = {
  base: 560,
  wall: 320,
  tall: 560,
};

/** Default module name, e.g. "Доод шүүгээ 600". */
export function kitchenGlbModuleName(
  role: KitchenGlbModuleRole,
  widthMm: number,
) {
  return `${KITCHEN_GLB_ROLE_LABELS[role]} ${Math.round(widthMm / 10) * 10}`;
}

/** Box of a module behind its front span, pushed away from the room centre. */
export function kitchenGlbModuleBox(
  front: KitchenGlbBox,
  role: KitchenGlbModuleRole,
  footprint: KitchenGlbBox,
  facing: KitchenGlbFacing,
): KitchenGlbBox {
  const box: KitchenGlbBox = { min: [...front.min], max: [...front.max] };
  const axis = facing[1] === "x" ? 0 : 2;
  const plane = (front.min[axis] + front.max[axis]) / 2;
  const depth = DEPTH[role];
  // The carcass lies behind the front, opposite to the facing direction.
  if (facing[0] === "+")
    box.min[axis] = Math.max(footprint.min[axis], plane - depth);
  else box.max[axis] = Math.min(footprint.max[axis], plane + depth);
  return box;
}

/** Facing of a front plane when neither a back plane nor a wall says otherwise. */
const defaultFacing = (
  axis: 0 | 2,
  back: number | null,
  plane: number,
): KitchenGlbFacing => {
  const sign = back === null ? "+" : back < plane ? "+" : "-";
  return `${sign}${axis === 0 ? "x" : "z"}` as KitchenGlbFacing;
};

/**
 * A horizontal slab with a side board rising alongside each end, flush with
 * its top, is the top panel of a carcass, not the worktop laid over it.
 */
function carcassTop(slab: KitchenGlbPart, parts: readonly KitchenGlbPart[]) {
  const [w, , d] = size(slab.box);
  const axis = w >= d ? 0 : 2;
  const across = axis === 0 ? 2 : 0;
  const sideAt = (end: number) =>
    parts.some((part) => {
      if (part === slab) return false;
      const sides = size(part.box);
      if (sides[axis] > BOARD || sides[1] < 300) return false;
      if (part.box.max[1] < slab.box.max[1] - 3) return false;
      if (part.box.min[1] > slab.box.min[1] - 100) return false;
      const overlap =
        Math.min(part.box.max[across], slab.box.max[across]) -
        Math.max(part.box.min[across], slab.box.min[across]);
      if (overlap < 0.5 * (slab.box.max[across] - slab.box.min[across]))
        return false;
      return part.box.min[axis] - 3 <= end && end <= part.box.max[axis] + 3;
    });
  return sideAt(slab.box.min[axis]) && sideAt(slab.box.max[axis]);
}

export function detectKitchenGlbModules(
  parts: readonly KitchenGlbPart[],
): KitchenGlbDetection {
  const footprint: KitchenGlbBox = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  // Room walls/floor exported with the kitchen must not widen the cabinet
  // footprint, so it is measured over boards (≤ 25 mm thick) when there are any.
  const boards = parts.filter((part) => Math.min(...size(part.box)) <= BOARD);
  for (const part of boards.length ? boards : parts)
    for (let axis = 0; axis < 3; axis++) {
      footprint.min[axis] = Math.min(footprint.min[axis], part.box.min[axis]);
      footprint.max[axis] = Math.max(footprint.max[axis], part.box.max[axis]);
    }
  let countertop = 0;
  const countertopParts: number[] = [];
  let backsplash = 0;
  // Fronts grouped by (thin axis, plane, role).
  const planes = new Map<
    string,
    {
      axis: 0 | 2;
      plane: number;
      role: KitchenGlbModuleRole;
      items: KitchenGlbPart[];
    }
  >();
  for (const part of parts) {
    const [w, h, d] = size(part.box);
    const bottom = part.box.min[1];
    const top = part.box.max[1];
    // Worktop: a horizontal 15–60 mm slab at counter height, resting on the
    // carcasses rather than held between their sides (that is a carcass top).
    if (
      h >= 12 &&
      h <= 60 &&
      bottom >= 700 &&
      bottom <= 1000 &&
      w * d >= 150_000 &&
      !carcassTop(part, parts)
    ) {
      countertop += (w * d) / 1e6;
      countertopParts.push(part.id);
      continue;
    }
    const thin = Math.min(w, d);
    const lateral = Math.max(w, d);
    if (thin > BOARD || h < 80) continue;
    // Splash-back: a thin vertical sheet starting just above the worktop.
    if (
      bottom >= 820 &&
      bottom <= 1000 &&
      h >= 150 &&
      top <= 1700 &&
      lateral >= 200
    ) {
      backsplash += (lateral * h) / 1e6;
      continue;
    }
    // Fronts: 150–1200 mm wide, never a full-length rail, never the floor-standing end panel.
    if (lateral < 150 || lateral > 1200) continue;
    const role = kitchenGlbRoleOf(bottom, top);
    if (!role || (role === "base" && bottom < 50)) continue;
    const axis: 0 | 2 = w <= d ? 0 : 2;
    const plane = (part.box.min[axis] + part.box.max[axis]) / 2;
    const bucket = [...planes.values()].find(
      (item) =>
        item.axis === axis &&
        item.role === role &&
        Math.abs(item.plane - plane) <= 30,
    );
    if (bucket) bucket.items.push(part);
    else
      planes.set(`${axis}:${role}:${round(plane)}`, {
        axis,
        plane,
        role,
        items: [part],
      });
  }

  const worktopTop = countertopParts.length
    ? Math.max(
        ...countertopParts.map(
          (id) => parts.find((part) => part.id === id)!.box.max[1],
        ),
      )
    : null;
  // Carcass backs form a second plane one cabinet depth behind the fronts.
  // The plane nearer an exported room wall is the back; without walls the
  // GLB convention applies (fronts face +Z / +X).
  const walls = parts.filter((part) => {
    const [w, h, d] = size(part.box);
    return (
      !kitchenGlbCurved(part) &&
      Math.min(w, d) > BOARD &&
      Math.min(w, d) <= 300 &&
      Math.max(w, d) >= 900 &&
      h >= 2000
    );
  });
  const span = (items: KitchenGlbPart[], along: number) => [
    Math.min(...items.map((part) => part.box.min[along])),
    Math.max(...items.map((part) => part.box.max[along])),
  ];
  const wallDistance = (axis: 0 | 2, plane: number) =>
    Math.min(
      Infinity,
      ...walls
        .filter((wall) => {
          const [w, , d] = size(wall.box);
          return (axis === 0 ? w : d) <= (axis === 0 ? d : w);
        })
        .map((wall) =>
          Math.abs((wall.box.min[axis] + wall.box.max[axis]) / 2 - plane),
        ),
    );
  const buckets = [...planes.values()];
  const backs = new Set<(typeof buckets)[number]>();
  const backPlane = new Map<(typeof buckets)[number], number>();
  const backStrength = new Map<(typeof buckets)[number], number>();
  for (const a of buckets)
    for (const b of buckets) {
      if (a === b || a.axis !== b.axis || a.role !== b.role) continue;
      const gap = Math.abs(a.plane - b.plane);
      if (gap < 200 || gap > 800) continue;
      const along = a.axis === 0 ? 2 : 0;
      const [a0, a1] = span(a.items, along);
      const [b0, b1] = span(b.items, along);
      const overlap = Math.min(a1, b1) - Math.max(a0, b0);
      // Fronts and their backs cover the same run; a run's side panels cover
      // only one cabinet depth of it and are not its back.
      if (overlap < 0.5 * Math.max(a1 - a0, b1 - b0)) continue;
      // Backs are thin hardboard; fronts are 16–22 mm. Failing that, the plane
      // nearer a room wall is the back; failing that, fronts face +Z / +X.
      const thickness = (bucket: typeof a) =>
        bucket.items.reduce(
          (sum, part) => sum + Math.min(...size(part.box)),
          0,
        ) / bucket.items.length;
      const ta = thickness(a);
      const tb = thickness(b);
      const da = wallDistance(a.axis, a.plane);
      const db = wallDistance(b.axis, b.plane);
      const aIsBack =
        Math.abs(ta - tb) >= 4
          ? ta < tb
          : Number.isFinite(da) || Number.isFinite(db)
            ? da < db
            : a.plane < b.plane;
      const front = aIsBack ? b : a;
      const back = aIsBack ? a : b;
      // A pair decided by board thickness outranks one decided by position.
      const strength = Math.abs(ta - tb) >= 4 ? 2 : 1;
      if ((backStrength.get(front) ?? 0) > strength || backs.has(front))
        continue;
      backs.add(back);
      backPlane.set(front, back.plane);
      backStrength.set(front, strength);
    }

  const modules: KitchenGlbModule[] = [];
  const lone: typeof buckets = [];
  let fronts = 0;
  for (const bucket of buckets) {
    if (backs.has(bucket)) continue;
    const { axis, role, items } = bucket;
    if (items.length < 2) lone.push(bucket);
    // Behind a front is its back plane, else the nearest exported wall; with
    // neither, the GLB convention (fronts face +Z / +X) decides.
    const nearestWall = walls
      .filter((wall) => {
        const [w, , d] = size(wall.box);
        return (axis === 0 ? w : d) <= (axis === 0 ? d : w);
      })
      .map((wall) => (wall.box.min[axis] + wall.box.max[axis]) / 2)
      .sort(
        (a, b) => Math.abs(a - bucket.plane) - Math.abs(b - bucket.plane),
      )[0];
    // The cabinet body lies behind its fronts: the side of the plane holding
    // more board/box volume over the same span and height is the back.
    const along = axis === 0 ? 2 : 0;
    const [from, to] = span(items, along);
    const bottom = Math.min(...items.map((part) => part.box.min[1]));
    const top = Math.max(...items.map((part) => part.box.max[1]));
    const mass = [0, 0];
    for (const part of parts) {
      if (items.includes(part) || walls.includes(part)) continue;
      const centre = (part.box.min[axis] + part.box.max[axis]) / 2;
      const across = (part.box.min[along] + part.box.max[along]) / 2;
      const distance = centre - bucket.plane;
      if (Math.abs(distance) < 15 || Math.abs(distance) > 700) continue;
      if (
        across < from ||
        across > to ||
        part.box.max[1] < bottom ||
        part.box.min[1] > top
      )
        continue;
      mass[distance < 0 ? 0 : 1] += size(part.box).reduce(
        (product, side) => product * side,
        1,
      );
    }
    const massBack =
      mass[0] + mass[1] > 0 && Math.max(...mass) > 1.5 * Math.min(...mass)
        ? bucket.plane + (mass[0] > mass[1] ? -1 : 1)
        : null;
    const facing = defaultFacing(
      axis,
      (backStrength.get(bucket) === 2 ? backPlane.get(bucket) : null) ??
        massBack ??
        backPlane.get(bucket) ??
        nearestWall ??
        null,
      bucket.plane,
    );
    // A lone board in a plane is a side panel, not a run of fronts.
    if (items.length < 2) continue;
    const spans = items
      .map((part) => ({
        part,
        from: part.box.min[along],
        to: part.box.max[along],
      }))
      .sort((a, b) => a.from - b.from);
    const merged: Array<{ from: number; to: number; parts: KitchenGlbPart[] }> =
      [];
    for (const span of spans) {
      const last = merged[merged.length - 1];
      // Stacked drawers share a span; side-by-side doors only touch.
      if (last && span.from < last.to - 40) {
        last.to = Math.max(last.to, span.to);
        last.parts.push(span.part);
      } else merged.push({ from: span.from, to: span.to, parts: [span.part] });
    }
    for (const span of merged) {
      // Fronts sharing a span are stacked (drawers, upper flap). Two boards
      // that overlap in height are back-to-back carcass sides, not fronts.
      const sides = span.parts.some((a, index) =>
        span.parts.slice(index + 1).some((b) => {
          const overlap =
            Math.min(a.box.max[1], b.box.max[1]) -
            Math.max(a.box.min[1], b.box.min[1]);
          const shorter = Math.min(
            a.box.max[1] - a.box.min[1],
            b.box.max[1] - b.box.min[1],
          );
          return overlap > shorter * 0.5;
        }),
      );
      if (sides) continue;
      fronts += span.parts.length;
      const front: KitchenGlbBox = {
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
      };
      for (const part of span.parts)
        for (let index = 0; index < 3; index++) {
          front.min[index] = Math.min(front.min[index], part.box.min[index]);
          front.max[index] = Math.max(front.max[index], part.box.max[index]);
        }
      const box = kitchenGlbModuleBox(front, role, footprint, facing);
      // A base unit stands on the floor and reaches the worktop even when its
      // only front is a short appliance trim.
      if (role !== "wall") {
        box.min[1] = Math.min(box.min[1], footprint.min[1]);
        if (role === "base")
          box.max[1] = Math.max(box.max[1], footprint.min[1] + 820);
      }
      const [bw, bh, bd] = size(box);
      const widthMm = round(span.to - span.from);
      modules.push({
        id: `m${modules.length + 1}`,
        role,
        name: kitchenGlbModuleName(role, widthMm),
        widthMm,
        heightMm: round(bh),
        depthMm: round(axis === 0 ? bw : bd),
        box,
        parts: span.parts.map((part) => part.id),
        facing,
      });
    }
  }
  // A single door in its plane (tall larder, one-door unit) is confirmed by its
  // carcass: the boards joined to it must form one plausible cabinet.
  const excluded = new Set(countertopParts);
  for (const bucket of lone) {
    const door = bucket.items[0];
    const [w, h, d] = size(door.box);
    if (h < 300 || Math.max(w, d) < 250) continue;
    const carcass = kitchenGlbGrowCabinet(door, parts, excluded);
    if (!carcass || carcass.parts.length < 4) continue;
    if (
      modules.some((module) => boxOverlapRatio(module.box, carcass.box) > 0.3)
    )
      continue;
    const role = kitchenGlbRoleOf(carcass.box.min[1], carcass.box.max[1]) ?? bucket.role;
    const along = bucket.axis === 0 ? 2 : 0;
    const widthMm = round(carcass.box.max[along] - carcass.box.min[along]);
    const [bw, bh, bd] = size(carcass.box);
    fronts += 1;
    modules.push({
      id: "",
      role,
      name: kitchenGlbModuleName(role, widthMm),
      widthMm,
      heightMm: round(bh),
      depthMm: round(bucket.axis === 0 ? bw : bd),
      box: carcass.box,
      parts: carcass.parts,
      facing: defaultFacing(
        bucket.axis,
        (carcass.box.min[bucket.axis] + carcass.box.max[bucket.axis]) / 2,
        bucket.plane,
      ),
    });
  }
  // Cabinets modelled as one solid box (common for tall housings and uppers).
  const named = (part: KitchenGlbPart) =>
    APPLIANCE_WORDS.test([part.name, ...part.materials].join(" "));
  const appliances = detectKitchenGlbAppliances(parts, worktopTop);
  const applianceIds = new Set(appliances.flatMap((item) => item.parts));
  const footprintAll = kitchenGlbUnion([
    footprint,
    ...parts.filter((part) => !walls.includes(part)).map((part) => part.box),
  ]);
  for (const part of parts) {
    const [w, h, d] = size(part.box);
    const width = Math.max(w, d);
    const depth = Math.min(w, d);
    if (depth < 250 || depth > 750 || width < 250 || width > 1300 || h < 250)
      continue;
    if (
      walls.includes(part) ||
      applianceIds.has(part.id) ||
      named(part) ||
      kitchenGlbCurved(part)
    )
      continue;
    const role = kitchenGlbRoleOf(part.box.min[1], part.box.max[1]);
    if (!role) continue;
    const depthAxis: 0 | 2 = w <= d ? 0 : 2;
    const edgeMin = part.box.min[depthAxis] - footprintAll.min[depthAxis];
    const edgeMax = footprintAll.max[depthAxis] - part.box.max[depthAxis];
    const facing = defaultFacing(
      depthAxis,
      edgeMin <= edgeMax
        ? footprintAll.min[depthAxis]
        : footprintAll.max[depthAxis],
      (part.box.min[depthAxis] + part.box.max[depthAxis]) / 2,
    );
    // Fronts already found on this box either fold into it or, when the box is
    // wider than any catalog unit, keep it split by door.
    const inside = modules.filter(
      (module) => boxOverlapRatio(module.box, part.box) > 0.3,
    );
    const widest = role === "base" ? 1000 : 900;
    if (inside.length > 1 && width > widest) continue;
    for (const merged of inside) modules.splice(modules.indexOf(merged), 1);
    modules.push({
      id: "",
      role,
      name: kitchenGlbModuleName(role, width),
      widthMm: round(width),
      heightMm: round(h),
      depthMm: round(depth),
      box: kitchenGlbUnion([part.box, ...inside.map((module) => module.box)]),
      parts: [part.id, ...inside.flatMap((module) => module.parts)],
      facing: inside[0]?.facing ?? facing,
    });
  }
  const order: Record<KitchenGlbModuleRole, number> = {
    base: 0,
    tall: 1,
    wall: 2,
  };
  modules.sort(
    (a, b) =>
      order[a.role] - order[b.role] ||
      a.box.min[0] - b.box.min[0] ||
      a.box.min[2] - b.box.min[2],
  );
  modules.forEach((module, index) => (module.id = `m${index + 1}`));
  return {
    modules,
    fronts,
    countertopM2: Math.round(countertop * 100) / 100,
    backsplashM2: Math.round(backsplash * 100) / 100,
    countertopParts,
    appliances,
  };
}

/** Share of the smaller box that lies inside the other. */
function boxOverlapRatio(a: KitchenGlbBox, b: KitchenGlbBox) {
  const shared = [0, 1, 2].reduce(
    (product, axis) =>
      product *
      Math.max(
        0,
        Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]),
      ),
    1,
  );
  const volume = (box: KitchenGlbBox) =>
    size(box).reduce((product, side) => product * side, 1);
  return shared / Math.max(1, Math.min(volume(a), volume(b)));
}

const area = (part: KitchenGlbPart) => {
  const sides = size(part.box).sort((a, b) => b - a);
  return sides[0] * sides[1];
};

/** The material covering the largest board area among these parts. */
function dominantMaterial(
  ids: readonly number[],
  parts: readonly KitchenGlbPart[],
  materials: Readonly<Record<string, KitchenGlbMaterial>>,
) {
  const totals = new Map<string, number>();
  for (const id of ids) {
    const part = parts.find((item) => item.id === id);
    const name = part?.materials.find((item) => materials[item]);
    if (part && name) totals.set(name, (totals.get(name) ?? 0) + area(part));
  }
  const best = [...totals].sort((a, b) => b[1] - a[1])[0]?.[0];
  return best ? { name: best, ...materials[best] } : null;
}

const WOOD = /oak|walnut|wood|veneer|царс|хушга|мод/i;
const STONE = /marble|granite|quartz|stone|гантиг|чулуу|кварц/i;

export function kitchenGlbFinish(
  material: KitchenGlbMaterial & { name: string },
): KitchenGlbFinish {
  if (material.textured || WOOD.test(material.name)) return "wood";
  return material.roughness < 0.35 ? "gloss" : "matte";
}

/**
 * Reads each module's front finish and the worktop surface from the GLB
 * materials, so the planner copy keeps the uploaded colours.
 */
export function kitchenGlbAssignMaterials(
  detection: KitchenGlbDetection,
  parts: readonly KitchenGlbPart[],
  materials: Readonly<Record<string, KitchenGlbMaterial>>,
): KitchenGlbDetection {
  const top = dominantMaterial(
    detection.countertopParts ?? [],
    parts,
    materials,
  );
  return {
    ...detection,
    modules: detection.modules.map((module) => {
      const front = dominantMaterial(module.parts, parts, materials);
      return front
        ? {
            ...module,
            color: module.color ?? front.color,
            finish: module.finish ?? kitchenGlbFinish(front),
          }
        : module;
    }),
    ...(top
      ? {
          countertopColor: top.color,
          countertopKind: STONE.test(top.name)
            ? "granite"
            : top.textured || WOOD.test(top.name)
              ? "wood"
              : "laminate",
        }
      : {}),
  };
}

/** A module the merchant creates by clicking a part that no module covers. */
export function kitchenGlbManualModule(
  part: KitchenGlbPart,
  all: readonly KitchenGlbPart[],
  id: string,
  excluded: ReadonlySet<number> = new Set(),
): KitchenGlbModule {
  const footprint: KitchenGlbBox = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (const item of all)
    for (let axis = 0; axis < 3; axis++) {
      footprint.min[axis] = Math.min(footprint.min[axis], item.box.min[axis]);
      footprint.max[axis] = Math.max(footprint.max[axis], item.box.max[axis]);
    }
  // Any board of a cabinet (side, top, back, door) selects the whole carcass.
  const carcass = kitchenGlbGrowCabinet(part, all, excluded);
  if (carcass) {
    const [cw, ch, cd] = size(carcass.box);
    // The back stands against the nearer footprint edge; the width runs along it.
    const edge = (axis: 0 | 2) =>
      Math.min(
        carcass.box.min[axis] - footprint.min[axis],
        footprint.max[axis] - carcass.box.max[axis],
      );
    const depthAxis: 0 | 2 =
      Math.abs(cw - cd) < 60 ? (edge(0) < edge(2) ? 0 : 2) : cw < cd ? 0 : 2;
    const middle =
      (carcass.box.min[depthAxis] + carcass.box.max[depthAxis]) / 2;
    const backSide =
      carcass.box.min[depthAxis] - footprint.min[depthAxis] <=
      footprint.max[depthAxis] - carcass.box.max[depthAxis]
        ? footprint.min[depthAxis]
        : footprint.max[depthAxis];
    const role = kitchenGlbRoleOf(carcass.box.min[1], carcass.box.max[1]) ?? "base";
    const widthMm = round(depthAxis === 0 ? cd : cw);
    return {
      id,
      role,
      name: kitchenGlbModuleName(role, widthMm),
      widthMm,
      heightMm: round(ch),
      depthMm: round(depthAxis === 0 ? cw : cd),
      box: carcass.box,
      parts: carcass.parts,
      facing: defaultFacing(depthAxis, backSide, middle),
      manual: true,
    };
  }
  const role = kitchenGlbRoleOf(part.box.min[1], part.box.max[1]) ?? "base";
  const [w, h, d] = size(part.box);
  const thin = Math.min(w, d) <= BOARD;
  const axis: 0 | 2 = w <= d ? 0 : 2;
  const plane = (part.box.min[axis] + part.box.max[axis]) / 2;
  // A clicked board faces away from the nearer footprint edge (its back wall).
  const facing = defaultFacing(
    axis,
    plane - footprint.min[axis] <= footprint.max[axis] - plane
      ? footprint.min[axis]
      : footprint.max[axis],
    plane,
  );
  const box = thin
    ? kitchenGlbModuleBox(part.box, role, footprint, facing)
    : part.box;
  const widthMm = round(Math.max(w, d));
  return {
    id,
    role,
    name: kitchenGlbModuleName(role, widthMm),
    widthMm,
    heightMm: round(h),
    depthMm: round(thin ? DEPTH[role] : Math.min(w, d)),
    box,
    parts: [part.id],
    facing,
    manual: true,
  };
}

/** Footprint of the cabinet boards (room walls exported with the kitchen excluded). */
export function kitchenGlbFootprint(
  parts: readonly KitchenGlbPart[],
): KitchenGlbBox {
  const footprint: KitchenGlbBox = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  const boards = parts.filter((part) => Math.min(...size(part.box)) <= BOARD);
  for (const part of boards.length ? boards : parts)
    for (let axis = 0; axis < 3; axis++) {
      footprint.min[axis] = Math.min(footprint.min[axis], part.box.min[axis]);
      footprint.max[axis] = Math.max(footprint.max[axis], part.box.max[axis]);
    }
  return footprint;
}

const nearest = (value: number, options: readonly number[]) =>
  options.reduce((best, item) =>
    Math.abs(item - value) < Math.abs(best - value) ? item : best,
  );
const clamp = (value: number, [min, max]: readonly [number, number]) =>
  Math.min(max, Math.max(min, value));

/**
 * Planner kitchen (ModularKitchen v1) rebuilt from the detected modules so a
 * GLB design can be opened and edited in the 3D kitchen planner. Widths snap
 * to catalog sizes; each cabinet keeps its back on the wall it was drawn on.
 */
export function kitchenGlbPlannerKitchen(
  modules: readonly KitchenGlbModule[],
  parts: readonly KitchenGlbPart[],
  options: {
    heightMm: number;
    layout?: ModularKitchen["layout"];
    backsplash?: boolean;
    countertopColor?: string;
    countertopKind?: "laminate" | "granite" | "wood";
    appliances?: readonly KitchenGlbAppliance[];
  },
): ModularKitchen | null {
  if (!modules.length) return null;
  const footprint = kitchenGlbFootprint(parts);
  const kitchen = createModularKitchen();
  kitchen.room = {
    width: Math.max(
      2000,
      Math.ceil((footprint.max[0] - footprint.min[0]) / 10) * 10,
    ),
    depth: Math.max(
      2400,
      Math.ceil((footprint.max[2] - footprint.min[2] + 900) / 10) * 10,
    ),
    height: clamp(Math.round(options.heightMm / 10) * 10, [2400, 3500]),
  };
  kitchen.layout = options.layout ?? "straight";
  if (options.countertopColor)
    kitchen.countertop = {
      ...kitchen.countertop,
      color: options.countertopColor,
      material: options.countertopKind ?? "laminate",
    };
  kitchen.backsplash = options.backsplash ?? false;
  const appliances = (options.appliances ?? []).map((item) => ({
    ...item,
    x: (item.box.min[0] + item.box.max[0]) / 2,
    y: (item.box.min[1] + item.box.max[1]) / 2,
    z: (item.box.min[2] + item.box.max[2]) / 2,
  }));
  const within = (
    module: KitchenGlbModule,
    item: (typeof appliances)[number],
  ) =>
    item.x >= module.box.min[0] - 20 &&
    item.x <= module.box.max[0] + 20 &&
    item.z >= module.box.min[2] - 20 &&
    item.z <= module.box.max[2] + 20 &&
    item.y >= module.box.min[1] - 400 &&
    item.y <= module.box.max[1] + 400;
  const used = new Set<string>();
  kitchen.cabinets = modules.map((module, index) => {
    const cx = (module.box.min[0] + module.box.max[0]) / 2;
    const cz = (module.box.min[2] + module.box.max[2]) / 2;
    const defaults = CABINET_DEFAULTS[module.role];
    const width = nearest(module.widthMm, cabinetWidths(module.role));
    // Floor units are at least 580 mm deep so ovens/hobs fit the planner's rules.
    const depth = clamp(
      module.role === "wall" ? module.depthMm : Math.max(module.depthMm, 580),
      defaults.depthRange,
    );
    const cabinet = createCabinet(
      module.role,
      `glb-${index + 1}`,
      width,
      kitchen.room.height,
    );
    // Front faces the room: rotation 0 → +Z, π → −Z, ±π/2 → ±X.
    let rotation: number;
    let x: number;
    let z: number;
    if (module.facing[1] === "z") {
      const plus = module.facing[0] === "+";
      rotation = plus ? 0 : Math.PI;
      x = cx;
      z = plus ? module.box.min[2] + depth / 2 : module.box.max[2] - depth / 2;
    } else {
      const plus = module.facing[0] === "+";
      rotation = plus ? Math.PI / 2 : -Math.PI / 2;
      z = cz;
      x = plus ? module.box.min[0] + depth / 2 : module.box.max[0] - depth / 2;
    }
    // Sink, hob and oven boxes need a 600 mm carcass in the planner; a hood
    // sits in an upper unit, a fridge or oven tower in a tall one.
    const inside = appliances.find((item) => {
      if (used.has(item.id) || !within(module, item)) return false;
      if (module.role === "base")
        return width >= 600 && ["sink", "hob", "oven"].includes(item.kind);
      if (module.role === "wall") return item.kind === "hood";
      return item.kind === "fridge" || (item.kind === "oven" && width >= 600);
    });
    if (inside) used.add(inside.id);
    const opening = inside
      ? inside.kind === "fridge"
        ? {
            opening: "refrigerator" as const,
            refrigeratorStyle: "top-bottom" as const,
          }
        : inside.kind === "hood"
          ? { opening: "hood" as const, hoodMount: "under-cabinet" as const }
          : { opening: inside.kind as "sink" | "hob" | "oven" }
      : null;
    const fronts = module.parts.length;
    return {
      ...cabinet,
      depth,
      height:
        module.role === "wall"
          ? clamp(module.heightMm, defaults.heightRange)
          : cabinet.height,
      position: {
        x: Math.round(x - footprint.min[0]),
        y:
          module.role === "wall"
            ? Math.round(module.box.min[1] - footprint.min[1])
            : 0,
        z: Math.round(z - footprint.min[2]),
        rotation,
      },
      autoElevation: false,
      ...(module.color ? { color: module.color } : {}),
      ...(module.finish
        ? {
            material:
              module.finish === "wood" ? ("wood" as const) : module.finish,
          }
        : {}),
      ...(opening
        ? opening
        : fronts >= 3 && module.role === "base"
          ? { opening: "drawers" as const, drawerCount: Math.min(4, fronts) }
          : {}),
    };
  });
  // Freestanding fridges and wall hoods outside every module become their own units.
  for (const item of appliances) {
    if (used.has(item.id) || (item.kind !== "fridge" && item.kind !== "hood"))
      continue;
    const [w, h, d] = size(item.box);
    const alongX = w >= d;
    const id = `glb-${item.kind}-${kitchen.cabinets.length + 1}`;
    const unit =
      item.kind === "fridge"
        ? createRefrigerator(id)
        : createHood(id, "wall", nearest(Math.max(w, d), [600, 900]));
    if (item.kind === "fridge") {
      unit.width = clamp(Math.round(alongX ? w : d), REFRIGERATOR_LIMITS.width);
      unit.height = clamp(Math.round(h), REFRIGERATOR_LIMITS.height);
      unit.depth = clamp(Math.round(alongX ? d : w), REFRIGERATOR_LIMITS.depth);
    }
    // Back to the nearer footprint edge, front to the room.
    const edgeZ = Math.min(
      item.box.min[2] - footprint.min[2],
      footprint.max[2] - item.box.max[2],
    );
    const edgeX = Math.min(
      item.box.min[0] - footprint.min[0],
      footprint.max[0] - item.box.max[0],
    );
    const facesZ = edgeZ <= edgeX;
    const plus = facesZ
      ? item.box.min[2] - footprint.min[2] <= footprint.max[2] - item.box.max[2]
      : item.box.min[0] - footprint.min[0] <=
        footprint.max[0] - item.box.max[0];
    unit.position = {
      x: Math.round(
        (facesZ
          ? item.x
          : plus
            ? item.box.min[0] + unit.depth / 2
            : item.box.max[0] - unit.depth / 2) - footprint.min[0],
      ),
      y:
        item.kind === "hood"
          ? Math.round(item.box.min[1] - footprint.min[1])
          : 0,
      z: Math.round(
        (facesZ
          ? plus
            ? item.box.min[2] + unit.depth / 2
            : item.box.max[2] - unit.depth / 2
          : item.z) - footprint.min[2],
      ),
      rotation: facesZ
        ? plus
          ? 0
          : Math.PI
        : plus
          ? Math.PI / 2
          : -Math.PI / 2,
    };
    unit.autoElevation = false;
    kitchen.cabinets.push(unit);
  }
  separateKitchenCabinets(kitchen.cabinets);
  // Separation may push a unit outward; the room grows to keep every cabinet inside.
  for (const cabinet of kitchen.cabinets) {
    const rect = cabinetRect(cabinet);
    kitchen.room.width = Math.max(
      kitchen.room.width,
      Math.ceil(rect.maxX / 10) * 10,
    );
    kitchen.room.depth = Math.max(
      kitchen.room.depth,
      Math.ceil(rect.maxZ / 10) * 10,
    );
  }
  // Rounding the room leaves a few mm behind units drawn against a wall, and an
  // upper unit measured from its doors may be shallower than its real box. The
  // planner requires wall units to touch the wall, so near backs snap flush.
  for (const cabinet of kitchen.cabinets) {
    const front =
      Math.round(Math.sin(cabinet.position.rotation)) * 2 +
      Math.round(Math.cos(cabinet.position.rotation));
    const half = cabinet.depth / 2;
    const reach = cabinet.type === "wall" ? 350 : 60;
    const { x, z } = cabinet.position;
    if (front === 1 && z - half < reach) cabinet.position.z = half; // faces +Z, back on z = 0
    if (front === -1 && kitchen.room.depth - (z + half) < reach)
      cabinet.position.z = kitchen.room.depth - half;
    if (front === 2 && x - half < reach) cabinet.position.x = half; // faces +X
    if (front === -2 && kitchen.room.width - (x + half) < reach)
      cabinet.position.x = kitchen.room.width - half;
  }
  return plannerSafe(kitchen);
}

/**
 * The planner enforces fitting rules (appliance boxes, hood clearance …). An
 * appliance it rejects is dropped back to a plain cabinet rather than losing
 * the whole planner copy.
 */
function plannerSafe(kitchen: ModularKitchen): ModularKitchen | null {
  const attempt = (candidate: ModularKitchen) => {
    try {
      parseKitchen(JSON.parse(JSON.stringify(candidate)));
      return true;
    } catch {
      return false;
    }
  };
  if (attempt(kitchen)) return kitchen;
  const standalone = (cabinet: PlannerCabinet) =>
    /^glb-(fridge|hood)-/.test(cabinet.id);
  const withoutStandalone = {
    ...kitchen,
    cabinets: kitchen.cabinets.filter((cabinet) => !standalone(cabinet)),
  };
  if (attempt(withoutStandalone)) return withoutStandalone;
  const plain = {
    ...withoutStandalone,
    cabinets: withoutStandalone.cabinets.map((cabinet) => {
      const copy = { ...cabinet };
      if (copy.opening && copy.opening !== "drawers") {
        delete copy.opening;
        delete copy.hoodMount;
        delete copy.refrigeratorStyle;
      }
      return copy;
    }),
  };
  return attempt(plain) ? plain : null;
}

type PlannerCabinet = ModularKitchen["cabinets"][number];

function cabinetRect(cabinet: PlannerCabinet) {
  const sideways = Math.abs(Math.sin(cabinet.position.rotation)) > 0.5;
  const halfX = (sideways ? cabinet.depth : cabinet.width) / 2;
  const halfZ = (sideways ? cabinet.width : cabinet.depth) / 2;
  return {
    minX: cabinet.position.x - halfX,
    maxX: cabinet.position.x + halfX,
    minZ: cabinet.position.z - halfZ,
    maxZ: cabinet.position.z + halfZ,
    minY: cabinet.position.y,
    maxY: cabinet.position.y + cabinet.height,
  };
}

/**
 * Catalog widths differ from the measured boards by a few millimetres, which
 * can make neighbours (and the two legs of an L) overlap. Slide the later
 * cabinet along its own run until it clears, keeping a 2 mm joint.
 */
function separateKitchenCabinets(cabinets: PlannerCabinet[]) {
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (let i = 0; i < cabinets.length; i++)
      for (let j = i + 1; j < cabinets.length; j++) {
        const a = cabinetRect(cabinets[i]);
        const b = cabinetRect(cabinets[j]);
        const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
        const overlapZ = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
        const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
        if (overlapX <= 0 || overlapZ <= 0 || overlapY <= 0) continue;
        const later = cabinets[j];
        const sideways = Math.abs(Math.sin(later.position.rotation)) > 0.5;
        if (sideways) {
          const direction = b.minZ + b.maxZ >= a.minZ + a.maxZ ? 1 : -1;
          later.position.z += direction * (overlapZ + 2);
        } else {
          const direction = b.minX + b.maxX >= a.minX + a.maxX ? 1 : -1;
          later.position.x += direction * (overlapX + 2);
        }
        later.position.x = Math.round(later.position.x);
        later.position.z = Math.round(later.position.z);
        moved = true;
      }
    if (!moved) return;
  }
}
