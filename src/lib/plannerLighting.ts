import { Color } from "three";
import type { RoomLighting } from "./types";
import { solarLighting } from "./roomLighting";

const nonNegative = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? Math.max(0, value!) : fallback;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/** Shared, neutral image-based fill; keep a little visibility after sunset. */
export function plannerEnvironmentIntensity(daylight = 1) {
  const amount = Number.isFinite(daylight)
    ? Math.max(0, Math.min(1, daylight))
    : 1;
  return 0.08 + 0.67 * amount;
}

/**
 * What the room itself does to the light that enters it. Without this every
 * room got the same flat fill: a windowless bathroom was as bright in its
 * corners as a glazed living room, and the bounce off a dark oak floor was the
 * same beige as off white tiles.
 */
export interface PlannerLightingContext {
  /** Window glass area / floor area. Residential rooms are typically 0.1–0.2. */
  glazing?: number;
  /** Floor finish colour; the hemisphere's ground term is its bounce. */
  floorColor?: string;
  /** Wall colour; a light room re-reflects more of its fill. */
  wallColor?: string;
}

/** 0.15 glazing ratio is a well-lit room; no windows still gets light through doors. */
export function daylightAdmittance(glazing?: number) {
  if (!Number.isFinite(glazing)) return 1;
  return clamp(0.32 + (glazing! / 0.15) * 0.68, 0.32, 1.2);
}

const DEFAULT_FLOOR = "#c6bba9";
const DEFAULT_WALLS = "#e8e4dc";
/** Finish names such as "oak" are not colours; fall back instead of a three.js warning. */
const hexColor = (value: string | undefined, fallback: string) =>
  value && /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(value) ? value : fallback;
const luminance = (color: Color) => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
/** Average reflectance 0.15 (dark) … 0.85 (white), walls dominating the view. */
const bounceGain = (walls: Color, floor: Color) =>
  0.72 + clamp(luminance(walls) * 0.65 + luminance(floor) * 0.35, 0.15, 0.85) * 0.5;

/**
 * Broad fill is intentionally weaker than direct light, so corners and material
 * colour remain visible. Saved ambient/sun sliders retain their relative range.
 *
 * Indirect light has two sources here. Daylight fill scales with how much sky
 * the windows admit; lamp fill (at night or with lamps on) is warm and does
 * not depend on windows. Their sum also grows with the room's reflectance:
 * light walls and floor bounce light around, dark ones absorb it.
 */
export function plannerLighting(lighting?: RoomLighting, context: PlannerLightingContext = {}) {
  const solar = solarLighting(lighting);
  const admittance = daylightAdmittance(context.glazing);
  const floor = new Color(hexColor(context.floorColor, DEFAULT_FLOOR));
  const walls = new Color(hexColor(context.wallColor, DEFAULT_WALLS));
  // Light walls and floor bounce more of the fill around; dark ones absorb it.
  // Relative to the default finish, so an unknown room keeps the reference rig.
  const bounce = bounceGain(walls, floor) / bounceGain(new Color(DEFAULT_WALLS), new Color(DEFAULT_FLOOR));
  const daylightFill = solar.daylight * admittance;
  // Lamps light every room equally, but only once they are switched on.
  const lampFill = solar.lampsOn ? 0.5 : 0;
  const ambientColor = new Color("#ffffff")
    .lerp(new Color("#ffe3c2"), clamp(lampFill / (lampFill + daylightFill + 1e-3), 0, 1));
  // Ground term: the sky bounced off this floor, tinted by its colour.
  const groundColor = new Color("#8a8276").lerp(floor, 0.65);
  return {
    solar,
    admittance,
    ambientIntensity:
      nonNegative(lighting?.ambient, 0.65) * (0.12 + 0.28 * daylightFill + 0.08 * lampFill) * bounce,
    hemisphereIntensity: (0.06 + 0.28 * daylightFill) * bounce,
    sunlightIntensity: nonNegative(lighting?.sunlight, 1.8) * solar.daylight,
    environmentIntensity: plannerEnvironmentIntensity(solar.daylight * Math.min(1, admittance)),
    ambientColor: `#${ambientColor.getHexString()}`,
    skyColor: "#f4f7fb",
    groundColor: `#${groundColor.getHexString()}`,
    sunColor: solar.warm ? "#ffdbb5" : "#fffaf2",
  };
}
