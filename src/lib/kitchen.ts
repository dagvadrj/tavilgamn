export const FINISHES = [
  { id: "matte", name: "Матт", color: "#ddd8cc", roughness: 0.85 },
  { id: "gloss", name: "Гялгар", color: "#faf8f2", roughness: 0.15 },
  { id: "oak", name: "Царс", color: "#bb915e", roughness: 0.65 },
  { id: "walnut", name: "Хушга", color: "#69503c", roughness: 0.65 },
  { id: "marble", name: "Гантиг", color: "#eeeae3", roughness: 0.3 },
  { id: "concrete", name: "Бетон", color: "#96958e", roughness: 0.95 },
] as const;

export type Finish = (typeof FINISHES)[number]["id"];
export type FrontStyle = "flat" | "shaker" | "glass";
export type HandleStyle = "bar" | "knob" | "none";
export const CABINET_TYPES = {
  single: { name: "Нэг хаалгатай", min: 300 },
  double: { name: "Хос хаалгатай", min: 600 },
  drawers: { name: "3 шургуулгатай", min: 300 },
  open: { name: "Ил тавиур", min: 300 },
  sink: { name: "Угаалтууртай", min: 600 },
  hob: { name: "Плиткатай", min: 600 },
} as const;
export type CabinetKind = keyof typeof CABINET_TYPES;
export type UpperKind = "auto" | "single" | "double" | "open";
export type RunId = "main" | "return";
export type Cabinet = { id: string; width: number; kind: CabinetKind; upper: boolean; upperKind?: UpperKind };
export type Kitchen = {
  layout: "straight" | "l";
  cornerSide: "left" | "right";
  returnWidth: number;
  cornerSize: number;
  cornerUpper: boolean;
  returnCabinets: Cabinet[];
  width: number;
  height: number;
  depth: number;
  upperHeight: number;
  upperDepth: number;
  gap: number;
  finish: Finish;
  color: string;
  upperColor: string;
  countertop: Finish;
  front: FrontStyle;
  handle: HandleStyle;
  backsplash: boolean;
  cabinets: Cabinet[];
};

export const DIMENSIONS = {
  width: { label: "A талын нийт урт", min: 600, max: 8000 },
  returnWidth: { label: "B талын нийт урт", min: 1200, max: 8000 },
  cornerSize: { label: "Булангийн хэмжээ", min: 850, max: 1200 },
  height: { label: "Доод хэсгийн нийт өндөр", min: 750, max: 1000 },
  depth: { label: "Доод хэсгийн гүн", min: 550, max: 800 },
  upperHeight: { label: "Дээд шүүгээний өндөр", min: 400, max: 1200 },
  upperDepth: { label: "Дээд шүүгээний гүн", min: 250, max: 450 },
  gap: { label: "Тавцангаас дээд шүүгээ хүртэл", min: 400, max: 900 },
} as const;
export type DimensionKey = keyof typeof DIMENSIONS;

export function createKitchen(): Kitchen {
  return {
    layout: "straight", cornerSide: "right", returnWidth: 2400, cornerSize: 900, cornerUpper: true,
    returnCabinets: [600, 600, 300].map((width, index) => ({
      id: `return-${index + 1}`, width, kind: "single", upper: true, upperKind: index === 2 ? "open" : "auto",
    })),
    width: 3000, height: 850, depth: 600,
    upperHeight: 720, upperDepth: 350, gap: 550,
    finish: "oak", color: "#bb915e", upperColor: "#e5d6bd",
    countertop: "marble", front: "flat", handle: "bar", backsplash: true,
    cabinets: (["drawers", "sink", "double", "hob", "single"] as const).map((kind, index) => ({
      id: `cabinet-${index + 1}`, width: 600, kind, upper: kind !== "hob",
    })),
  };
}

export function usedWidth(cabinets: Cabinet[]) {
  return cabinets.reduce((sum, cabinet) => sum + cabinet.width, 0);
}

export function kitchenHeight(kitchen: Kitchen) {
  if (kitchen.cabinets.some(cabinet => cabinet.upper) || (kitchen.layout === "l" &&
    (kitchen.cornerUpper || kitchen.returnCabinets.some(cabinet => cabinet.upper)))) {
    return kitchen.height + kitchen.gap + kitchen.upperHeight;
  }
  return kitchen.height + (kitchen.backsplash ? kitchen.gap : 0);
}

export function cabinetMinimumWidth(cabinet: Cabinet) {
  return Math.max(CABINET_TYPES[cabinet.kind].min, cabinet.upper && cabinet.upperKind === "double" ? 600 : 300);
}

export function runCabinets(kitchen: Kitchen, run: RunId) {
  return run === "main" ? kitchen.cabinets : kitchen.returnCabinets;
}

export function runCapacity(kitchen: Kitchen, run: RunId) {
  if (kitchen.layout === "straight") return run === "main" ? kitchen.width : 0;
  return (run === "main" ? kitchen.width : kitchen.returnWidth) - kitchen.cornerSize;
}

export function withRunCabinets(kitchen: Kitchen, run: RunId, cabinets: Cabinet[]): Kitchen {
  return { ...kitchen, [run === "main" ? "cabinets" : "returnCabinets"]: cabinets };
}

export function activeRuns(kitchen: Kitchen): RunId[] {
  return kitchen.layout === "l" ? ["main", "return"] : ["main"];
}

export type PlanBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type CabinetPlacement = {
  cabinet: Cabinet; run: RunId; x: number; z: number; rotation: number; bounds: PlanBounds;
};

export function cornerFootprint(size: number, depth: number): [number, number][] {
  return [[0, 0], [size, 0], [size, size], [size - depth, size], [0, depth]];
}

/** Coordinates in mm. Mirroring is applied by the scene to the whole assembly. */
export function kitchenPlan(kitchen: Kitchen) {
  const width = kitchen.width;
  const depth = kitchen.layout === "l" ? kitchen.returnWidth : kitchen.depth;
  const mirrored = kitchen.layout === "l" && kitchen.cornerSide === "left";
  const mirrorBounds = (bounds: PlanBounds): PlanBounds => mirrored
    ? { ...bounds, minX: width - bounds.maxX, maxX: width - bounds.minX } : bounds;
  const placements: CabinetPlacement[] = [];
  for (const run of activeRuns(kitchen)) {
    let offset = 0;
    for (const cabinet of runCabinets(kitchen, run)) {
      const main = run === "main";
      placements.push({ cabinet, run,
        x: main ? offset + cabinet.width / 2 : width,
        z: main ? 0 : kitchen.cornerSize + offset + cabinet.width / 2,
        rotation: main ? 0 : -Math.PI / 2,
        bounds: mirrorBounds(main
          ? { minX: offset, maxX: offset + cabinet.width, minZ: 0, maxZ: kitchen.depth }
          : { minX: width - kitchen.depth, maxX: width, minZ: kitchen.cornerSize + offset, maxZ: kitchen.cornerSize + offset + cabinet.width }),
      });
      offset += cabinet.width;
    }
  }
  return { width, depth, mirrored, placements,
    cornerPoints: cornerFootprint(kitchen.cornerSize, kitchen.depth).map(([x, z]) => [
      mirrored ? kitchen.cornerSize - x : width - kitchen.cornerSize + x, z,
    ] as [number, number]),
    corner: kitchen.layout === "l" ? mirrorBounds({ minX: width - kitchen.cornerSize, maxX: width, minZ: 0, maxZ: kitchen.cornerSize }) : null,
  };
}

/** Switching shape retains modules; make room for the corner when necessary. */
export function changeKitchenLayout(kitchen: Kitchen, layout: Kitchen["layout"]): Kitchen {
  if (layout === "straight") return { ...kitchen, layout };
  const cornerSize = Math.max(kitchen.cornerSize, kitchen.depth + 300);
  const next = { ...kitchen, layout, cornerSize };
  for (const run of activeRuns(next)) {
    const cabinets = runCabinets(next, run);
    const capacity = runCapacity(next, run);
    if (usedWidth(cabinets) <= capacity) continue;
    const fitted = fitCabinets(cabinets, capacity);
    if (fitted) {
      if (run === "main") next.cabinets = fitted;
      else next.returnCabinets = fitted;
    } else if (run === "main") next.width = usedWidth(cabinets) + cornerSize;
    else next.returnWidth = usedWidth(cabinets) + cornerSize;
  }
  return next;
}

/** Allocate whole millimetres, respecting each module's minimum and 1200 mm maximum. */
export function fitCabinets(cabinets: Cabinet[], target: number): Cabinet[] | null {
  if (!Number.isInteger(target) || !cabinets.length || target > cabinets.length * 1200) return null;
  const fitted = cabinets.map(cabinet => ({ ...cabinet, width: cabinetMinimumWidth(cabinet) }));
  let remaining = target - usedWidth(fitted);
  if (remaining < 0) return null;
  while (remaining > 0) {
    const available = fitted.filter(cabinet => cabinet.width < 1200);
    if (!available.length) return null;
    const increment = Math.max(1, Math.floor(remaining / available.length));
    for (const cabinet of available) {
      const amount = Math.min(increment, 1200 - cabinet.width, remaining);
      cabinet.width += amount;
      remaining -= amount;
    }
  }
  return fitted;
}

export function validateKitchen(kitchen: Kitchen): string | null {
  for (const key of Object.keys(DIMENSIONS) as DimensionKey[]) {
    if (kitchen.layout === "straight" && (key === "returnWidth" || key === "cornerSize")) continue;
    const { label, min, max } = DIMENSIONS[key];
    if (!Number.isInteger(kitchen[key]) || kitchen[key] < min || kitchen[key] > max) {
      return `${label}: ${min}–${max} мм-ийн хооронд бүхэл тоо оруулна уу.`;
    }
  }
  if (kitchen.layout === "l" && kitchen.cornerSize < kitchen.depth + 300) {
    return `Булангийн хэмжээ доод хэсгийн гүнээс дор хаяж 300 мм их буюу ${kitchen.depth + 300} мм-ээс эхэлнэ.`;
  }
  for (const run of activeRuns(kitchen)) {
    const label = run === "main" ? "A тал" : "B тал";
    const cabinets = runCabinets(kitchen, run);
    if (!cabinets.length) return `${label}: дор хаяж нэг шүүгээ үлдээнэ үү.`;
    for (const cabinet of cabinets) {
      const minimum = cabinetMinimumWidth(cabinet);
      if (!Number.isInteger(cabinet.width) || cabinet.width < minimum || cabinet.width > 1200) {
        return `${label} — ${CABINET_TYPES[cabinet.kind].name}: өргөн ${minimum}–1200 мм байна.`;
      }
    }
    if (usedWidth(cabinets) > runCapacity(kitchen, run)) return `${label}: шүүгээнүүд буланд үлдээсэн зайг хассан уртаас хэтэрлээ.`;
  }
  return null;
}
