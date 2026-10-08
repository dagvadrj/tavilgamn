import type { RoomLighting } from "./types";

export const lightingTime = (lighting?: RoomLighting) => Math.min(23.99, Math.max(0, Number.isFinite(lighting?.timeOfDay) ? lighting!.timeOfDay! : lighting?.mode === "evening" ? 21 : 12));
export const formatLightingTime = (time: number) => `${String(Math.floor(time)).padStart(2, "0")}:${String(Math.round((time % 1) * 60)).padStart(2, "0")}`;
/** A visual solar cycle: sunrise 06:00, sunset 20:00. */
export function solarLighting(lighting?: RoomLighting) {
  const time = lightingTime(lighting);
  const night = time >= 20 || time < 6;
  const angle = (time - 6) / 14 * Math.PI;
  const daylight = night ? 0 : Math.min(1, Math.max(0, Math.sin(angle)) * 3);
  return { time, night, daylight, angle, lampsOn: lighting?.autoLights === false || night,
    warm: daylight < 0.65,
  };
}
/** Screen-facing room captions fade as the camera enters the room. */
export function roomLabelOpacity(distance: number, roomSpan: number) {
  const value = Math.max(0, Math.min(1, (distance / Math.max(roomSpan, 1) - 1.05) / 0.85));
  return value * value * (3 - 2 * value);
}
