import type { RoomLighting } from "./types";
export const ROOM_DAY_BACKDROP = "#ecebe7";
export const ROOM_NIGHT_BACKDROP = "#252c38";

export const lightingTime = (lighting?: RoomLighting) => Math.min(23.99, Math.max(0, Number.isFinite(lighting?.timeOfDay) ? lighting!.timeOfDay! : lighting?.mode === "evening" ? 21 : 12));
export const formatLightingTime = (time: number) => `${String(Math.floor(time)).padStart(2, "0")}:${String(Math.round((time % 1) * 60)).padStart(2, "0")}`;
/** Share of ceiling-light output left on in daytime: fixtures glow and shade walls softly. */
export const DAY_LAMP_LEVEL = 0.4;
/** A visual solar cycle: sunrise 06:00, sunset 20:00. */
export function solarLighting(lighting?: RoomLighting) {
  const time = lightingTime(lighting);
  const night = time >= 20 || time < 6;
  const angle = (time - 6) / 14 * Math.PI;
  const daylight = night ? 0 : Math.min(1, Math.max(0, Math.sin(angle)) * 3);
  const lampsOn = lighting?.autoLights === false || night;
  return { time, night, daylight, angle, lampsOn, lampLevel: lampsOn ? 1 : DAY_LAMP_LEVEL,
    warm: daylight < 0.65,
  };
}
/** Screen-facing room captions fade as the camera enters the room. */
export function roomLabelOpacity(distance: number, roomSpan: number) {
  const value = Math.max(0, Math.min(1, (distance / Math.max(roomSpan, 1) - 1.05) / 0.85));
  return value * value * (3 - 2 * value);
}
