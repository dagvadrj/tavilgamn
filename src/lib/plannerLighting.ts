import type { RoomLighting } from "./types";
import { solarLighting } from "./roomLighting";

const nonNegative = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? Math.max(0, value!) : fallback;

/** Shared, neutral image-based fill; keep a little visibility after sunset. */
export function plannerEnvironmentIntensity(daylight = 1) {
  const amount = Number.isFinite(daylight)
    ? Math.max(0, Math.min(1, daylight))
    : 1;
  return 0.08 + 0.67 * amount;
}

/**
 * Broad fill is intentionally weaker than direct light, so corners and material
 * colour remain visible. Saved ambient/sun sliders retain their relative range.
 */
export function plannerLighting(lighting?: RoomLighting) {
  const solar = solarLighting(lighting);
  return {
    solar,
    ambientIntensity:
      nonNegative(lighting?.ambient, 0.65) * (0.12 + 0.28 * solar.daylight),
    hemisphereIntensity: 0.06 + 0.28 * solar.daylight,
    sunlightIntensity: nonNegative(lighting?.sunlight, 1.8) * solar.daylight,
    environmentIntensity: plannerEnvironmentIntensity(solar.daylight),
    ambientColor: solar.night ? "#a8b9d3" : "#ffffff",
    skyColor: "#f4f7fb",
    groundColor: "#c6bba9",
    sunColor: solar.warm ? "#ffdbb5" : "#fffaf2",
  };
}
