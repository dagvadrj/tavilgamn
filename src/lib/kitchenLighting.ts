import type { CabinetPose, ModularKitchen } from "./kitchenCabinets";

export type KitchenLineLighting = {
  underCabinet: boolean;
  plinth: boolean;
  tone: "warm" | "neutral" | "cool";
  brightness: number;
};
export const DEFAULT_KITCHEN_LINE_LIGHTING: KitchenLineLighting = {
  underCabinet: false,
  plinth: false,
  tone: "warm",
  brightness: 70,
};
export const KITCHEN_LIGHT_COLORS = {
  warm: "#ffd9a0",
  neutral: "#fff4de",
  cool: "#dfedff",
} as const;

export function parseKitchenLineLighting(
  value: unknown,
): KitchenLineLighting | undefined {
  if (value === undefined) return undefined;
  const raw = value as KitchenLineLighting;
  if (
    !raw ||
    typeof raw.underCabinet !== "boolean" ||
    typeof raw.plinth !== "boolean" ||
    !["warm", "neutral", "cool"].includes(raw.tone) ||
    !Number.isInteger(raw.brightness) ||
    raw.brightness < 0 ||
    raw.brightness > 100
  )
    throw new Error("Шугаман гэрлийн тохиргоо буруу байна.");
  return {
    underCabinet: raw.underCabinet,
    plinth: raw.plinth,
    tone: raw.tone,
    brightness: raw.brightness,
  };
}
export type KitchenLightStrip = {
  id: string;
  kind: "underCabinet" | "plinth";
  length: number;
  position: CabinetPose;
};
/** Join touching strips on the same face; keep different heights and rotations separate. */
export function kitchenLightStrips(
  kitchen: ModularKitchen,
): KitchenLightStrip[] {
  const settings = kitchen.lineLighting;
  if (!settings) return [];
  const strips: KitchenLightStrip[] = [];
  for (const kind of ["underCabinet", "plinth"] as const) {
    if (!settings[kind]) continue;
    const groups = new Map<
      string,
      {
        rotation: number;
        y: number;
        across: number;
        ranges: [number, number][];
      }
    >();
    for (const c of kitchen.cabinets) {
      if (
        kind === "underCabinet"
          ? c.type !== "wall" || c.opening === "hood"
          : c.type !== "base"
      )
        continue;
      const r = c.position.rotation,
        cos = Math.cos(r),
        sin = Math.sin(r);
      const along = c.position.x * cos - c.position.z * sin;
      // Mount the low profile on the front face so legless catalog bodies cannot hide it.
      const across =
        c.position.x * sin +
        c.position.z * cos +
        c.depth / 2 +
        (kind === "plinth" ? 4 : -35);
      const y = kind === "underCabinet" ? c.position.y - 5 : 25;
      const key = [r.toFixed(4), y.toFixed(1), across.toFixed(1)].join(":");
      const group = groups.get(key) ?? { rotation: r, y, across, ranges: [] };
      group.ranges.push([along - c.width / 2, along + c.width / 2]);
      groups.set(key, group);
    }
    for (const group of groups.values()) {
      const merged: [number, number][] = [];
      for (const range of group.ranges.sort((a, b) => a[0] - b[0])) {
        const last = merged.at(-1);
        if (last && range[0] <= last[1] + 2)
          last[1] = Math.max(last[1], range[1]);
        else merged.push([...range]);
      }
      for (const [start, end] of merged) {
        const along = (start + end) / 2,
          r = group.rotation;
        strips.push({
          id: `line-${kind}-${strips.length}`,
          kind,
          length: end - start,
          position: {
            x: along * Math.cos(r) + group.across * Math.sin(r),
            z: -along * Math.sin(r) + group.across * Math.cos(r),
            y: group.y,
            rotation: r,
          },
        });
      }
    }
  }
  return strips;
}
