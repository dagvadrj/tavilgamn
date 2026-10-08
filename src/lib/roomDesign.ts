import type { DesignRoom, RoomDesign, RoomType, RoomLighting, RoomSurfaces, RoomWall, WallMaterial } from "./types";
import { ROOM_TYPES } from "./roomGeometry";
import { positionedRooms, validConnections } from "./roomLayout";
import { normalizeRoomCeiling } from "./roomCeiling";
import { normalizeSunBearing } from "./roomSunlight";
import { lightingTime } from "./roomLighting";

export const DEFAULT_FLOOR_MATERIAL = "parquet-oak";
/** Old saved floor colours keep their appearance until a library material is chosen. */
export const LEGACY_FLOOR_MATERIAL = "legacy";
export const DEFAULT_CEILING_MATERIAL = "ceiling-white";
export const DEFAULT_ROOM_LIGHTING: RoomLighting = { mode: "day", timeOfDay: 12, autoLights: true, ambient: 0.65, sunlight: 1.8, fixtures: [] };
const WALLS: RoomWall[] = ["north", "east", "south", "west"];

/** Each saved room owns all nested surface state, including fixture positions. */
function cloneSurfaces(room: RoomSurfaces & { wallColor?: string; id?: string; width?: number; depth?: number }): RoomSurfaces {
  const wallMaterials: Partial<Record<RoomWall, WallMaterial>> = {};
  for (const wall of WALLS) wallMaterials[wall] = { mode: "color", color: room.wallColor ?? "#EFE6D6", ...room.wallMaterials?.[wall] };
  const lighting: RoomLighting = { ...DEFAULT_ROOM_LIGHTING, ...room.lighting, timeOfDay: lightingTime(room.lighting), fixtures: ((room.lighting?.autoLights === undefined && room.lighting?.fixtures.length === 0 ? undefined : room.lighting?.fixtures) ?? (room.id ? [{ id: `ceiling-${room.id}`, x: 0, z: 0, intensity: 18, color: "#ffe3b3" }] : [])).map(fixture => ({ ...fixture })) };
  if (Number.isFinite(lighting.sunAzimuth)) lighting.sunAzimuth = normalizeSunBearing(lighting.sunAzimuth!); else delete lighting.sunAzimuth;
  if (Number.isFinite(lighting.sunElevation)) lighting.sunElevation = Math.max(5,Math.min(75,lighting.sunElevation!)); else delete lighting.sunElevation;
  return {
    floorMaterial: room.floorMaterial ?? LEGACY_FLOOR_MATERIAL,
    ceilingMaterial: room.ceilingMaterial ?? DEFAULT_CEILING_MATERIAL,
    ceiling: normalizeRoomCeiling(room.ceiling,room.width && room.depth ? {width:room.width,depth:room.depth}:undefined),
    wallMaterials,
    lighting,
  };
}

export function cloneRoom(room: DesignRoom): DesignRoom {
  return { ...room, height: room.height ?? 2.7,
    ...cloneSurfaces(room),
    pieces: room.pieces.map(piece => ({ ...piece, ...(piece.kitchen ? { kitchen: JSON.parse(JSON.stringify(piece.kitchen)) } : {}) })),
    wallFeatures: (room.wallFeatures ?? []).map(feature => ({ ...feature })),
    columns: (room.columns ?? []).map(column => ({ ...column })),
    openings: (room.openings ?? []).map(opening => ({ ...opening })),
  };
}

/** Migrate old single-room saves while keeping the active-room cache in sync. */
export function syncDesignRooms(design: RoomDesign): RoomDesign {
  const activeRoomId = design.activeRoomId ?? `${design.id}-room-1`;
  const type = design.roomType ?? "living";
  const active = cloneRoom({ id: activeRoomId, name: design.roomName ?? ROOM_TYPES[type].label, type,
    width: design.width, depth: design.depth, height: design.height,
    position: design.rooms?.find(room => room.id === activeRoomId)?.position,
    wallColor: design.wallColor, floorColor: design.floorColor, pieces: design.pieces,
    wallFeatures: design.wallFeatures, columns: design.columns,
    openings: design.openings, floorMaterial: design.floorMaterial, wallMaterials: design.wallMaterials,
    ceilingMaterial: design.ceilingMaterial, ceiling: design.ceiling, lighting: design.lighting,
  });
  let rooms = (design.rooms ?? []).map(room => room.id === activeRoomId ? active : cloneRoom(room));
  if (!rooms.some(room => room.id === activeRoomId)) rooms.unshift(active);
  rooms = positionedRooms(rooms).map(room => {
    const lighting = { ...room.lighting!, timeOfDay: lightingTime(active.lighting), mode: active.lighting!.mode };
    delete lighting.sunAzimuth; delete lighting.sunElevation;
    if (active.lighting!.sunAzimuth !== undefined) lighting.sunAzimuth = active.lighting!.sunAzimuth;
    if (active.lighting!.sunElevation !== undefined) lighting.sunElevation = active.lighting!.sunElevation;
    return { ...room, lighting };
  });
  return { ...design, connections: validConnections(rooms, design.connections ?? []), activeRoomId, roomName: active.name, roomType: type, height: active.height,
    wallFeatures: active.wallFeatures, columns: active.columns, openings: active.openings,
    ...cloneSurfaces(active), pieces: active.pieces, rooms };
}

export function activateDesignRoom(design: RoomDesign, id: string): RoomDesign {
  const synced = syncDesignRooms(design);
  const room = synced.rooms!.find(item => item.id === id);
  if (!room) return synced;
  return { ...synced, activeRoomId: room.id, roomName: room.name, roomType: room.type,
    width: room.width, depth: room.depth, height: room.height,
    wallColor: room.wallColor, floorColor: room.floorColor, pieces: room.pieces,
    wallFeatures: room.wallFeatures, columns: room.columns,
    openings: room.openings, ...cloneSurfaces(room),
  };
}

export function newDesignRoom(type: RoomType, existing: DesignRoom[]): DesignRoom {
  const preset = ROOM_TYPES[type];
  const count = existing.filter(room => room.type === type).length;
  return cloneRoom({ id: `room_${crypto.randomUUID()}`, name: preset.label + (count ? ` ${count + 1}` : ""), type,
    width: preset.width, depth: preset.depth, height: 2.7, wallColor: "#EFE6D6", floorColor: "#C9A37A",
    floorMaterial: DEFAULT_FLOOR_MATERIAL,
    pieces: [], wallFeatures: [], columns: [],
  });
}
