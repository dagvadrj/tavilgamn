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
export type Cabinet = { id: string; width: number; kind: CabinetKind; upper: boolean };
export type Kitchen = {
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
  width: { label: "Нийт өргөн", min: 600, max: 8000 },
  height: { label: "Доод хэсгийн нийт өндөр", min: 750, max: 1000 },
  depth: { label: "Доод хэсгийн гүн", min: 550, max: 800 },
  upperHeight: { label: "Дээд шүүгээний өндөр", min: 400, max: 1200 },
  upperDepth: { label: "Дээд шүүгээний гүн", min: 250, max: 450 },
  gap: { label: "Тавцангаас дээд шүүгээ хүртэл", min: 400, max: 900 },
} as const;
export type DimensionKey = keyof typeof DIMENSIONS;

export function createKitchen(): Kitchen {
  return {
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
  if (kitchen.cabinets.some(cabinet => cabinet.upper)) return kitchen.height + kitchen.gap + kitchen.upperHeight;
  return kitchen.height + (kitchen.backsplash ? kitchen.gap : 0);
}

/** Allocate whole millimetres, respecting each module's minimum and 1200 mm maximum. */
export function fitCabinets(cabinets: Cabinet[], target: number): Cabinet[] | null {
  if (!Number.isInteger(target) || !cabinets.length || target > cabinets.length * 1200) return null;
  const fitted = cabinets.map(cabinet => ({ ...cabinet, width: CABINET_TYPES[cabinet.kind].min as number }));
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
    const { label, min, max } = DIMENSIONS[key];
    if (!Number.isInteger(kitchen[key]) || kitchen[key] < min || kitchen[key] > max) {
      return `${label}: ${min}–${max} мм-ийн хооронд бүхэл тоо оруулна уу.`;
    }
  }
  if (!kitchen.cabinets.length) return "Дор хаяж нэг шүүгээ үлдээнэ үү.";
  for (const cabinet of kitchen.cabinets) {
    const minimum = CABINET_TYPES[cabinet.kind].min;
    if (!Number.isInteger(cabinet.width) || cabinet.width < minimum || cabinet.width > 1200) {
      return `${CABINET_TYPES[cabinet.kind].name}: өргөн ${minimum}–1200 мм байна.`;
    }
  }
  if (usedWidth(kitchen.cabinets) > kitchen.width) return "Шүүгээнүүдийн нийлбэр өргөн нийт хэмжээнээс хэтэрлээ.";
  return null;
}
