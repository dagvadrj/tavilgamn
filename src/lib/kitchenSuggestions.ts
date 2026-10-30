import {
  BASE_CABINET_WIDTHS,
  CABINET_WIDTHS,
  createCabinet,
  createHood,
  createRefrigerator,
  type KitchenLayout,
  type KitchenRoom,
  type ModularCabinet,
  type ModularKitchen,
} from "./kitchenCabinets";
import { arrangeKitchen, createUnifiedKitchen } from "./kitchenAssembly";
import { withOpening } from "./kitchenComponents";
import type { RoomSetupDimensions } from "./roomSetup";
import { placementIssues, resolveElevations } from "./kitchenPlacement";

export type OvenPreference = "under-worktop" | "high-cabinet";
export type HoodPreference = "integrated" | "wall" | "none";
export type RefrigeratorPreference = "integrated" | "freestanding" | "none";
export type SuggestionLayout = "straight" | "l-right" | "u" | "double-side";

export interface KitchenSuggestionPreferences {
  oven: OvenPreference;
  hood: HoodPreference;
  refrigerator: RefrigeratorPreference;
  layout: SuggestionLayout;
}

export const DEFAULT_KITCHEN_SUGGESTION: KitchenSuggestionPreferences = {
  oven: "under-worktop",
  hood: "integrated",
  refrigerator: "integrated",
  layout: "l-right",
};

/** Build a real editable design from the short suggestion questionnaire. */
export function createSuggestedKitchen(
  preferences: KitchenSuggestionPreferences,
  roomDimensions?: RoomSetupDimensions,
  options: { fill?: boolean; room?: KitchenRoom } = {},
): ModularKitchen {
  const kitchen = createUnifiedKitchen();
  if (roomDimensions) {
    kitchen.room = { width: Math.round(roomDimensions.width * 1000), depth: Math.round(roomDimensions.depth * 1000), height: Math.round(roomDimensions.height * 1000) };
  }
  // The surveyed room (doors, windows, water, vent) steers the arrangement.
  if (options.room) kitchen.room = { ...options.room };
  const baseOven = kitchen.cabinets.find(
    (cabinet) => cabinet.type === "base" && cabinet.opening === "oven",
  );

  if (preferences.oven === "high-cabinet" && baseOven) {
    // Keep the cooktop in the base run while moving only the oven cavity up.
    Object.assign(baseOven, withOpening(baseOven, "hob"));
    const tallOven = withOpening(
      createCabinet("tall", "suggested-tall-oven", 600, kitchen.room.height),
      "oven",
    );
    tallOven.finish = baseOven.finish;
    tallOven.frontStyle = baseOven.frontStyle;
    tallOven.color = baseOven.color;
    kitchen.cabinets.push(tallOven);
  }

  const cooker = kitchen.cabinets.find(
    (cabinet) => cabinet.opening === "oven" || cabinet.opening === "hob",
  );
  if (preferences.hood !== "none" && cooker) {
    const hood = createHood(
      "suggested-hood",
      preferences.hood === "integrated" ? "under-cabinet" : "wall",
      600,
    );
    hood.position.x = cooker.position.x;
    hood.position.z = cooker.position.z;
    if (preferences.hood === "integrated") {
      hood.finish = "oak";
      hood.color = "#e5d6bd";
      hood.material = "wood";
    }
    kitchen.cabinets.push(hood);
  }

  if (preferences.refrigerator !== "none") {
    const refrigerator = createRefrigerator(
      "suggested-refrigerator",
      preferences.refrigerator === "integrated" ? "top-bottom" : "side-by-side",
    );
    if (preferences.refrigerator === "integrated") {
      refrigerator.finish = "oak";
      refrigerator.frontStyle = "flat";
      refrigerator.color = "#e5d6bd";
      refrigerator.material = "wood";
    }
    refrigerator.refrigeratorInstallation = preferences.refrigerator;
    kitchen.cabinets.push(refrigerator);
  }

  // The wizard must not produce an out-of-room straight run with tall appliances.
  if (preferences.layout === "straight" && !roomDimensions) {
    const span = kitchen.cabinets.filter(c => c.type !== "wall").reduce((sum, c) => sum + c.width, 0);
    kitchen.room.width = Math.max(kitchen.room.width, span + 400);
  }
  let arranged = arrangeKitchen(kitchen, preferences.layout as KitchenLayout);
  if (roomDimensions) {
    // Reduce storage before sacrificing a chosen appliance or changing the room.
    for (let attempt = 0; attempt < kitchen.cabinets.length; attempt++) {
      const errors = placementIssues(arranged).filter(issue => issue.severity === "error");
      if (!errors.length) break;
      const affected = new Set(errors.flatMap(issue => issue.ids));
      const removable = arranged.cabinets.filter(c => !["sink", "oven", "hob", "hood", "refrigerator"].includes(c.opening ?? ""));
      const candidate = removable.find(c => affected.has(c.id)) ?? removable.at(-1);
      if (!candidate) break;
      arranged = arrangeKitchen({ ...arranged, cabinets: arranged.cabinets.filter(c => c.id !== candidate.id) }, preferences.layout);
    }
  }
  arranged = alignToServices(arranged, preferences.layout);
  return preferences.layout === "u" && options.fill !== false ? fillUKitchen(arranged) : arranged;
}

const isCooker = (c: ModularCabinet) => c.type === "base" && (c.opening === "oven" || c.opening === "hob");
const pointDistance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Score of a finished arrangement against the room's water and vent points and
 * the usual work rules: the sink by the water, the hob (and its hood) by the
 * vent, worktop between the two, and the hob off a side wall or a tall unit.
 */
export function serviceLayoutCost(kitchen: ModularKitchen) {
  const items = kitchen.room.items ?? [];
  const sink = kitchen.cabinets.find(c => c.opening === "sink");
  const cooker = kitchen.cabinets.find(isCooker);
  const nearest = (kind: "water" | "vent", at?: ModularCabinet) => {
    const points = items.filter(item => item.kind === kind);
    return at && points.length ? Math.min(...points.map(p => pointDistance(at.position, p))) : 0;
  };
  let cost = nearest("water", sink) + nearest("vent", cooker);
  if (sink && cooker) {
    // Sharing a run, at least one 400 mm+ unit of prep space between them.
    const same = Math.abs(Math.cos(sink.position.rotation - cooker.position.rotation) - 1) < 1e-6;
    const gap = pointDistance(sink.position, cooker.position) - (sink.width + cooker.width) / 2;
    if (same && gap < 400) cost += 1500;
  }
  if (cooker) {
    const { width, depth } = kitchen.room;
    const along = Math.abs(Math.sin(cooker.position.rotation)) > .5 ? cooker.position.z : cooker.position.x;
    const extent = Math.abs(Math.sin(cooker.position.rotation)) > .5 ? depth : width;
    if (Math.min(along, extent - along) - cooker.width / 2 < 300) cost += 1200;
    for (const tall of kitchen.cabinets.filter(c => c.type === "tall"))
      if (pointDistance(tall.position, cooker.position) - (tall.width + cooker.width) / 2 < 50 &&
        Math.abs(Math.cos(tall.position.rotation - cooker.position.rotation) - 1) < 1e-6) cost += 1200;
  }
  return cost;
}

/**
 * Re-order the sink and the cooker inside the floor runs so they land by the
 * room's water and vent points. Only those two move; tall units and storage
 * keep their order, the hood follows the cooker as its upper.
 */
export function alignToServices(kitchen: ModularKitchen, layout: SuggestionLayout | KitchenLayout): ModularKitchen {
  const items = kitchen.room.items ?? [];
  if (!items.some(item => item.kind === "water" || item.kind === "vent")) return kitchen;
  const floor = kitchen.cabinets.filter(c => c.type !== "wall");
  const upper = kitchen.cabinets.filter(c => c.type === "wall");
  const sink = floor.find(c => c.opening === "sink");
  const cooker = floor.find(isCooker);
  if (!sink && !cooker) return kitchen;
  const rest = floor.filter(c => c !== sink && c !== cooker);
  const valid = (k: ModularKitchen) => !placementIssues(k).some(issue => issue.severity === "error");
  let best = kitchen, bestCost = valid(kitchen) ? serviceLayoutCost(kitchen) : Infinity;
  const slots = rest.length + 1;
  for (let i = 0; i < (sink ? slots : 1); i++) for (let j = 0; j < slots + (sink ? 1 : 0); j++) {
    const order = [...rest];
    if (sink) order.splice(i, 0, sink);
    if (cooker) order.splice(Math.min(j, order.length), 0, cooker);
    if (order.every((c, index) => c === floor[index])) continue;
    const candidate = arrangeKitchen({ ...kitchen, cabinets: [...order, ...upper] }, layout as KitchenLayout);
    if (!valid(candidate)) continue;
    // Small tie-break keeps the familiar order when the points don't care.
    const moved = order.reduce((sum, c, index) => sum + Math.abs(floor.indexOf(c) - index), 0);
    const cost = serviceLayoutCost(candidate) + moved;
    if (cost < bestCost - 1) { best = candidate; bestCost = cost; }
    if (!cooker) break;
  }
  return best;
}

type RunWall = "back" | "left" | "right";
export interface FillWidths { base: readonly number[]; wall: readonly number[] }
// Up to 600 mm keeps fronts regular; 150/200 only close a remainder.
const DEFAULT_FILL_WIDTHS: FillWidths = { base: BASE_CABINET_WIDTHS.filter(w => w <= 600), wall: CABINET_WIDTHS };
const runWall = (c: ModularCabinet): RunWall | null =>
  ({ 0: "back", 1: "left", [-1]: "right" } as Record<number, RunWall>)[Math.round(c.position.rotation / (Math.PI / 2))] ?? null;
const runSpan = (c: ModularCabinet) => {
  const centre = runWall(c) === "back" ? c.position.x : c.position.z;
  return [centre - c.width / 2, centre + c.width / 2] as const;
};

/** Fewest widths that fill most of a gap (10 mm grid); an unfillable rest stays as a filler strip. */
function fillWidths(gap: number, widths: readonly number[]): number[] {
  const usable = widths.filter(w => w > 0 && w % 10 === 0).map(w => w / 10);
  const steps = Math.floor(gap / 10);
  const best: (number[] | null)[] = [[]];
  for (let i = 1; i <= steps; i++) {
    best[i] = null;
    for (const w of usable) {
      const prev = w <= i ? best[i - w] : null;
      if (prev && (!best[i] || prev.length + 1 < best[i]!.length)) best[i] = [...prev, w * 10];
    }
  }
  for (let i = steps; i > 0; i--) if (best[i]) return best[i]!.sort((a, b) => b - a);
  return [];
}

/** Free stretches of [start, end] not covered by the given spans. */
function freeGaps(start: number, end: number, taken: (readonly [number, number])[]) {
  const gaps: [number, number][] = [];
  let cursor = start;
  for (const [from, to] of [...taken].sort((a, b) => a[0] - b[0])) {
    if (from > cursor) gaps.push([cursor, Math.min(from, end)]);
    cursor = Math.max(cursor, to);
  }
  if (end > cursor) gaps.push([cursor, end]);
  return gaps.filter(([a, b]) => b > a);
}

/**
 * The suggested U only has a handful of modules; centred on the back wall they
 * leave empty corners and short sides. Fill every run wall to wall (sides up to
 * a 1 m entry) with matching base units, then hang matching uppers along the
 * whole run except over tall units and the hood. `widths` limits the fillers to
 * what the catalog can actually supply.
 */
export function fillUKitchen(kitchen: ModularKitchen, widths: FillWidths = DEFAULT_FILL_WIDTHS): ModularKitchen {
  const { width: roomWidth, depth: roomDepth } = kitchen.room;
  const floor = kitchen.cabinets.filter(c => c.type !== "wall" && runWall(c));
  const baseStyle = floor.find(c => c.type === "base" && (c.opening ?? "doors") === "doors") ?? floor.find(c => c.type === "base");
  const upperStyle = kitchen.cabinets.find(c => c.type === "wall" && c.opening !== "hood") ?? baseStyle;
  if (!baseStyle || !upperStyle) return kitchen;
  const inset = Math.max(...floor.filter(c => runWall(c) === "back").map(c => c.depth), baseStyle.depth);
  const sideEnd = (wall: RunWall) =>
    Math.max(...floor.filter(c => runWall(c) === wall).map(c => runSpan(c)[1]), 0);
  const sideTarget = Math.max(sideEnd("left"), sideEnd("right"), Math.min(roomDepth - 1000, inset + 1800));
  const ranges: Record<RunWall, [number, number]> = {
    back: [0, roomWidth],
    left: [inset, sideTarget],
    right: [inset, sideTarget],
  };
  const added: ModularCabinet[] = [];
  let index = 0;
  const place = (template: ModularCabinet, type: "base" | "wall", wall: RunWall, from: number, width: number) => {
    let id: string;
    do id = `suggested-fill-${type}-${++index}`; while (kitchen.cabinets.some(c => c.id === id));
    const c = createCabinet(type, id, width);
    for (const key of ["finish", "frontStyle", "color", "material", "handleStyle"] as const)
      (c as unknown as Record<string, unknown>)[key] = template[key];
    c.opening = "doors";
    const centre = from + width / 2, y = c.position.y;
    c.position = wall === "back" ? { x: centre, y, z: c.depth / 2, rotation: 0 }
      : wall === "left" ? { x: c.depth / 2, y, z: centre, rotation: Math.PI / 2 }
      : { x: roomWidth - c.depth / 2, y, z: centre, rotation: -Math.PI / 2 };
    added.push(c);
  };
  const fill = (type: "base" | "wall", wall: RunWall, gaps: [number, number][]) => {
    for (const [from, to] of gaps) {
      let cursor = from;
      for (const width of fillWidths(to - from, widths[type])) {
        place(type === "base" ? baseStyle : upperStyle, type, wall, cursor, width);
        cursor += width;
      }
    }
  };
  for (const wall of ["back", "left", "right"] as const) {
    const [start, end] = ranges[wall];
    fill("base", wall, freeGaps(start, end, floor.filter(c => runWall(c) === wall).map(runSpan)));
    // Uppers follow the finished base run and stop at tall units and the hood.
    const run = [...floor, ...added].filter(c => c.type !== "wall" && runWall(c) === wall).map(runSpan);
    if (!run.length) continue;
    const blocked = kitchen.cabinets.filter(c => (c.type === "tall" || c.type === "wall") && runWall(c) === wall).map(runSpan);
    fill("wall", wall, freeGaps(Math.max(start, Math.min(...run.map(s => s[0]))), Math.min(end, Math.max(...run.map(s => s[1]))), blocked));
  }
  let next = resolveElevations({ ...kitchen, cabinets: [...kitchen.cabinets, ...added] });
  // A filler that meets a window, door or another unit is dropped, never the chosen modules.
  for (let attempt = 0; attempt < added.length; attempt++) {
    const bad = new Set(placementIssues(next).filter(i => i.severity === "error").flatMap(i => i.ids));
    const drop = next.cabinets.filter(c => c.id.startsWith("suggested-fill-") && bad.has(c.id));
    if (!drop.length) break;
    next = resolveElevations({ ...next, cabinets: next.cabinets.filter(c => !drop.includes(c)) });
  }
  return next;
}
