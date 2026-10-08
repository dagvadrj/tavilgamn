import type { RoomDesign, RoomLighting, RoomWall } from "./types";
import { connectionGeometry } from "./roomLayout";
import { solarLighting } from "./roomLighting";

const BEARING: Record<RoomWall,number> = { north: 0, east: 90, south: 180, west: 270 };
export const normalizeSunBearing = (degrees:number) => ((degrees % 360) + 360) % 360;
/** Shared world sun follows an exterior window, independent of the active room or camera. */
export function exteriorWindowBearing(design: RoomDesign): number {
  const rooms = design.rooms ?? [];
  const windows = rooms.length
    ? rooms.flatMap(room => connectionGeometry(room,rooms,design.connections??[]).visibleOpenings.filter(o=>o.kind==="window"))
    : (design.openings??[]).filter(o=>o.kind==="window");
  windows.sort((a,b)=>b.width*b.height-a.width*a.height || a.id.localeCompare(b.id));
  return windows[0] ? BEARING[windows[0].wallId] : 0;
}
export function sunDirection(lighting?: RoomLighting, windowBearing = 0) {
  const solar = solarLighting(lighting);
  const bearing = Number.isFinite(lighting?.sunAzimuth) ? normalizeSunBearing(lighting!.sunAzimuth!) : windowBearing + 18;
  const azimuth = normalizeSunBearing(bearing + (solar.time - 13) / 7 * 38);
  const elevation = Number.isFinite(lighting?.sunElevation) ? Math.max(5,Math.min(75,lighting!.sunElevation!)) : 6 + 38 * Math.max(0,Math.sin(solar.angle));
  const az = azimuth * Math.PI / 180, el = elevation * Math.PI / 180;
  return { azimuth,elevation,x:Math.sin(az)*Math.cos(el),y:Math.sin(el),z:-Math.cos(az)*Math.cos(el) };
}
