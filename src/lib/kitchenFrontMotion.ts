/**
 * Admin corrections for fronts detected automatically in a single, fully
 * assembled cabinet GLB. Keys are mesh positions in GLB traversal order
 * (`m0`, `m1`, …); anything without an entry keeps the detected motion.
 */
export type KitchenFrontKind = "door" | "drawer" | "fixed";
export type KitchenHingeSide = "left" | "right";
export type KitchenFrontOverride = {
  kind: KitchenFrontKind;
  hinge?: KitchenHingeSide;
};
export type KitchenFrontMotionMap = Record<string, KitchenFrontOverride>;

export const KITCHEN_FRONT_KIND_LABELS: Record<KitchenFrontKind, string> = {
  door: "Хаалга",
  drawer: "Шургуулга",
  fixed: "Хөдөлгөөнгүй",
};

/**
 * Manual depth bands in mm, measured from the front face: door thickness
 * backwards (5–100) or handle projection forwards (1–100).
 */
export function parseKitchenFrontSlab(
  value: unknown,
  min = 5,
): number | null {
  const mm = Number(value);
  return Number.isFinite(mm) && mm >= min && mm <= 100 ? Math.round(mm) : null;
}

export function parseKitchenFrontMotion(
  value: unknown,
): KitchenFrontMotionMap | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result: KitchenFrontMotionMap = {};
  for (const [key, raw] of Object.entries(value).slice(0, 200)) {
    if (!/^m\d{1,5}$/.test(key) || !raw || typeof raw !== "object") continue;
    const { kind, hinge } = raw as Record<string, unknown>;
    if (kind !== "door" && kind !== "drawer" && kind !== "fixed") continue;
    result[key] =
      kind === "door" && (hinge === "left" || hinge === "right")
        ? { kind, hinge }
        : { kind };
  }
  return Object.keys(result).length ? result : null;
}
