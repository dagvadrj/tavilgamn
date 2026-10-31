/**
 * Board-level reading of a full-kitchen GLB exported as loose panels.
 *
 * Cabinets: a carcass is the set of boards joined edge-to-face (side ↔ top,
 * side ↔ back, door ↔ side). Boards only touching face-to-face (a neighbour's
 * side), or only at a corner line (a neighbour's door), belong to another
 * cabinet. A divider shared by two cabinets is kept but never crossed.
 *
 * Appliances: everything that is not a board, grouped by contact and named by
 * its material/node names or, failing that, by its size and height.
 * Units: millimetres, Y up.
 */
import type { KitchenGlbBox, KitchenGlbPart } from "./kitchenGlbModules";

const BOARD = 25;
const TOUCH = 3;

const size = (box: KitchenGlbBox) =>
  box.max.map((value, axis) => value - box.min[axis]) as [
    number,
    number,
    number,
  ];
const thinAxis = (part: KitchenGlbPart) => {
  const sides = size(part.box);
  return sides.indexOf(Math.min(...sides));
};
const isBoard = (part: KitchenGlbPart) => Math.min(...size(part.box)) <= BOARD;

export function kitchenGlbUnion(
  boxes: readonly KitchenGlbBox[],
): KitchenGlbBox {
  const box: KitchenGlbBox = {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
  for (const item of boxes)
    for (let axis = 0; axis < 3; axis++) {
      box.min[axis] = Math.min(box.min[axis], item.min[axis]);
      box.max[axis] = Math.max(box.max[axis], item.max[axis]);
    }
  return box;
}

/** Overlap of two boxes per axis (negative = gap). */
const overlaps = (a: KitchenGlbBox, b: KitchenGlbBox) =>
  [0, 1, 2].map(
    (axis) =>
      Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]),
  );

/**
 * A carcass joint: the boards meet along exactly one axis (touching or a
 * shallow rebate) and overlap clearly along the other two.
 */
function joined(a: KitchenGlbPart, b: KitchenGlbPart) {
  if (thinAxis(a) === thinAxis(b)) return false; // face to face: a neighbour
  const values = overlaps(a.box, b.box);
  if (values.some((value) => value < -TOUCH)) return false;
  // Meeting along one axis (a top resting on a side, a door against its
  // carcass) joins; meeting along two (a neighbour's door at our side's
  // corner) is only a line contact and does not.
  const touching = values.filter((value) => value <= TOUCH).length;
  return touching <= 1 && values.some((value) => value > BOARD);
}

export type KitchenGlbCarcass = { box: KitchenGlbBox; parts: number[] };

/**
 * The cabinet a board belongs to. Returns null when the boards do not form a
 * plausible single cabinet (e.g. a carcass sharing one long bottom with its run).
 */
export function kitchenGlbGrowCabinet(
  seed: KitchenGlbPart,
  parts: readonly KitchenGlbPart[],
  excluded: ReadonlySet<number> = new Set(),
): KitchenGlbCarcass | null {
  if (!isBoard(seed)) return null;
  // Run-long boards (plinths, shared bottoms, rails) would join a whole run.
  const candidates = parts.filter(
    (part) =>
      part.id !== seed.id &&
      !excluded.has(part.id) &&
      isBoard(part) &&
      Math.max(...size(part.box)) <= 1300,
  );
  const neighbours = (part: KitchenGlbPart) =>
    candidates.filter((other) => joined(part, other));
  // A vertical board joined on both of its faces is a divider shared by two cabinets.
  const divider = (part: KitchenGlbPart) => {
    const axis = thinAxis(part);
    if (axis === 1) return false;
    const middle = (part.box.min[axis] + part.box.max[axis]) / 2;
    const sides = new Set(
      neighbours(part)
        .filter(
          (other) => thinAxis(other) !== axis && size(other.box)[axis] > 60,
        )
        .map((other) =>
          (other.box.min[axis] + other.box.max[axis]) / 2 < middle ? -1 : 1,
        ),
    );
    return sides.size === 2;
  };
  const group = new Map<number, KitchenGlbPart>([[seed.id, seed]]);
  const queue = [seed];
  // A divider seed grows to the side with more joined boards.
  let seedSide: number | null = null;
  if (divider(seed)) {
    const axis = thinAxis(seed);
    const middle = (seed.box.min[axis] + seed.box.max[axis]) / 2;
    const side = (other: KitchenGlbPart) =>
      (other.box.min[axis] + other.box.max[axis]) / 2 < middle ? -1 : 1;
    const joinedBoards = neighbours(seed);
    seedSide =
      joinedBoards.filter((other) => side(other) === 1).length >=
      joinedBoards.filter((other) => side(other) === -1).length
        ? 1
        : -1;
  }
  while (queue.length) {
    const current = queue.pop()!;
    if (current !== seed && divider(current)) continue;
    for (const other of neighbours(current)) {
      if (group.has(other.id)) continue;
      if (current === seed && seedSide !== null) {
        const axis = thinAxis(seed);
        const middle = (seed.box.min[axis] + seed.box.max[axis]) / 2;
        if (
          ((other.box.min[axis] + other.box.max[axis]) / 2 < middle
            ? -1
            : 1) !== seedSide
        )
          continue;
      }
      group.set(other.id, other);
      queue.push(other);
    }
  }
  if (group.size < 3) return null;
  const box = kitchenGlbUnion([...group.values()].map((part) => part.box));
  const [w, , d] = size(box);
  if (Math.max(w, d) > 1300 || Math.min(w, d) < 200) return null;
  return { box, parts: [...group.keys()] };
}

export type KitchenGlbApplianceKind =
  | "sink"
  | "faucet"
  | "hob"
  | "hood"
  | "oven"
  | "microwave"
  | "fridge"
  | "dishwasher";

export const KITCHEN_GLB_APPLIANCE_LABELS: Record<
  KitchenGlbApplianceKind,
  string
> = {
  sink: "Угаалтуур",
  faucet: "Холигч цорго",
  hob: "Плитка",
  hood: "Утаа сорогч",
  oven: "Шарах шүүгээ",
  microwave: "Богино долгионы зуух",
  fridge: "Хөргөгч",
  dishwasher: "Аяга таваг угаагч",
};

const APPLIANCE_NAMES: Array<[RegExp, KitchenGlbApplianceKind]> = [
  [/sink|мойк|угаалтуур|раковин/i, "sink"],
  [/faucet|\btap\b|mixer|смесител|холигч/i, "faucet"],
  [/cooker|cooktop|\bhob\b|induction|индукц|плит|stove/i, "hob"],
  [/hood|вытяж|сорогч/i, "hood"],
  [/micro ?wave|микровол|богино долгион/i, "microwave"],
  [/oven|духов|шарах/i, "oven"],
  [/fridge|refrigerator|холодил|хөргөгч/i, "fridge"],
  [/dish ?washer|посудомо|аяга таваг/i, "dishwasher"],
];

export type KitchenGlbAppliance = {
  id: string;
  kind: KitchenGlbApplianceKind;
  box: KitchenGlbBox;
  parts: number[];
  /** True when recognised by name, false when guessed from its size. */
  named: boolean;
};

/** Size/height rules for appliances whose meshes carry no meaningful name. */
function guessAppliance(
  box: KitchenGlbBox,
  worktopTop: number | null,
): KitchenGlbApplianceKind | null {
  const [w, h, d] = size(box);
  const width = Math.max(w, d);
  const depth = Math.min(w, d);
  const bottom = box.min[1];
  const top = box.max[1];
  if (
    h >= 1400 &&
    h <= 2100 &&
    width >= 500 &&
    width <= 1000 &&
    depth >= 500 &&
    bottom < 150
  )
    return "fridge";
  // Built-in oven / microwave sizes are distinctive; test them before the
  // looser sink and hood rules that would also match these boxes.
  if (width >= 540 && width <= 620 && h >= 440 && h <= 620 && depth >= 400)
    return "oven";
  if (
    width >= 420 &&
    width <= 620 &&
    h >= 250 &&
    h < 440 &&
    depth >= 280 &&
    bottom >= 700
  )
    return "microwave";
  if (worktopTop !== null) {
    if (
      h <= 120 &&
      Math.abs(top - worktopTop) <= 90 &&
      width >= 300 &&
      width <= 950
    )
      return "hob";
    if (
      bottom >= worktopTop - 350 &&
      bottom < worktopTop &&
      // The bowl hangs from the worktop: its rim reaches the worktop level.
      top >= worktopTop - 80 &&
      // A sink bowl hangs below the worktop; its tap may rise well above it.
      top <= worktopTop + 600 &&
      width >= 300 &&
      width <= 1100
    )
      return "sink";
  }
  // A hood is a shallow canopy (with or without chimney); a 300–1100 mm tall
  // box this high up is an upper cabinet.
  if (bottom >= 1300 && width >= 450 && width <= 1100 && h <= 700)
    return "hood";
  if (width >= 540 && width <= 620 && h >= 440 && h <= 620) return "oven";
  if (width >= 420 && width <= 620 && h >= 250 && h < 440 && bottom >= 700)
    return "microwave";
  return null;
}

/**
 * Appliances and fixtures: non-board parts grouped by contact. Room walls,
 * handles and other small hardware are ignored.
 */
export function detectKitchenGlbAppliances(
  parts: readonly KitchenGlbPart[],
  worktopTop: number | null,
): KitchenGlbAppliance[] {
  const label = (part: KitchenGlbPart) =>
    [part.name, ...part.materials].join(" ");
  const named = (part: KitchenGlbPart) =>
    APPLIANCE_NAMES.find(([pattern]) => pattern.test(label(part)))?.[1] ?? null;
  // Cabinet-sized solids (a tall housing, an oven) stay separate even when
  // they touch; only smaller pieces (bowls, taps, hob glass) are merged.
  const big = (part: KitchenGlbPart) => {
    const [w, h, d] = size(part.box);
    return Math.min(w, d) >= 250 && h >= 250;
  };
  const solids = parts.filter((part) => {
    const [w, h, d] = size(part.box);
    if (named(part)) return true;
    if (isBoard(part) || Math.max(w, h, d) < 150) return false; // boards, handles, hinges
    // Upright panels up to 40 mm (thick fronts, end panels) are joinery too.
    if (Math.min(w, d) <= 40 && h >= 80 && Math.max(w, d) >= 150) return false;
    const wall = h >= 1500 && Math.min(w, d) < 320 && Math.max(w, d) > 900;
    return !wall && Math.max(w, d) <= 2000;
  });
  const groups: KitchenGlbPart[][] = [];
  const seen = new Set<number>();
  for (const start of solids) {
    if (seen.has(start.id)) continue;
    seen.add(start.id);
    const group = [start];
    for (let index = 0; index < group.length; index++)
      for (const other of solids)
        if (
          !seen.has(other.id) &&
          overlaps(group[index].box, other.box).every((value) => value >= -10)
        ) {
          // Pieces of one named appliance always join; different named kinds
          // stay apart (a tap joins its sink); unnamed cabinet-sized solids
          // never swallow their neighbours.
          const a = named(group[index]);
          const b = named(other);
          const sinkSet = (kind: KitchenGlbApplianceKind | null) =>
            kind === "sink" || kind === "faucet";
          const sameNamed = a && b && (a === b || (sinkSet(a) && sinkSet(b)));
          if (a && b && !sameNamed) continue;
          if (!sameNamed && (big(group[index]) || big(other))) continue;
          seen.add(other.id);
          group.push(other);
        }
    groups.push(group);
  }
  const appliances: KitchenGlbAppliance[] = [];
  for (const group of groups) {
    const box = kitchenGlbUnion(group.map((part) => part.box));
    const names = group
      .map(named)
      .filter((kind): kind is KitchenGlbApplianceKind => !!kind);
    // A sink with its tap counts as a sink plus a faucet.
    const kinds = new Set(names);
    if (kinds.size) {
      for (const kind of kinds)
        appliances.push({
          id: `a${appliances.length + 1}`,
          kind,
          box: kitchenGlbUnion(
            group
              .filter((part) => named(part) === kind)
              .map((part) => part.box),
          ),
          parts: group
            .filter((part) => named(part) === kind)
            .map((part) => part.id),
          named: true,
        });
      continue;
    }
    const guess = guessAppliance(box, worktopTop);
    if (guess)
      appliances.push({
        id: `a${appliances.length + 1}`,
        kind: guess,
        box,
        parts: group.map((part) => part.id),
        named: false,
      });
  }
  // An unnamed body touching a named appliance of the same kind is its other
  // half (an oven's glass front is named, its box is not).
  for (const guess of appliances.filter((item) => !item.named)) {
    const owner = appliances.find(
      (item) =>
        item.named &&
        item.kind === guess.kind &&
        overlaps(item.box, guess.box).every((value) => value >= -10),
    );
    if (!owner) continue;
    owner.parts.push(...guess.parts);
    owner.box = kitchenGlbUnion([owner.box, guess.box]);
    appliances.splice(appliances.indexOf(guess), 1);
  }
  return appliances;
}

/** "Плитка · 2 ш" lines for the BOM, in a stable order. */
export function kitchenGlbApplianceLines(
  appliances: readonly KitchenGlbAppliance[],
) {
  const counts = new Map<KitchenGlbApplianceKind, number>();
  for (const item of appliances)
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  return (
    Object.keys(KITCHEN_GLB_APPLIANCE_LABELS) as KitchenGlbApplianceKind[]
  )
    .filter((kind) => counts.has(kind))
    .map(
      (kind) => `${KITCHEN_GLB_APPLIANCE_LABELS[kind]} · ${counts.get(kind)} ш`,
    );
}
