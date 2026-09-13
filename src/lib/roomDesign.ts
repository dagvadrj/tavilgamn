import type { DesignRoom, RoomDesign, RoomType, RoomLighting, RoomSurfaces, RoomWall, WallMaterial } from "./types";
import { ROOM_TYPES } from "./roomGeometry";

export const DEFAULT_FLOOR_MATERIAL = "parquet-oak";
/** Old saved floor colours keep their appearance until a library material is chosen. */
export const LEGACY_FLOOR_MATERIAL = "legacy";
export const DEFAULT_CEILING_MATERIAL = "ceiling-white";
export const DEFAULT_ROOM_LIGHTING: RoomLighting = { mode: "day", ambient: 0.65, sunlight: 1.8, fixtures: [] };
const WALLS: RoomWall[] = ["north", "east", "south", "west"];

/** Each saved room owns all nested surface state, including fixture positions. */
function cloneSurfaces(room: RoomSurfaces & { wallColor?: string }): RoomSurfaces {
  const wallMaterials: Partial<Record<RoomWall, WallMaterial>> = {};
  for (const wall of WALLS) wallMaterials[wall] = { mode: "color", color: room.wallColor ?? "#EFE6D6", ...room.wallMaterials?.[wall] };
  return {
    floorMaterial: room.floorMaterial ?? LEGACY_FLOOR_MATERIAL,
    ceilingMaterial: room.ceilingMaterial ?? DEFAULT_CEILING_MATERIAL,
    wallMaterials,
    lighting: { ...DEFAULT_ROOM_LIGHTING, ...room.lighting, fixtures: (room.lighting?.fixtures ?? []).map(fixture => ({ ...fixture })) },
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
    wallColor: design.wallColor, floorColor: design.floorColor, pieces: design.pieces,
    wallFeatures: design.wallFeatures, columns: design.columns,
    openings: design.openings, floorMaterial: design.floorMaterial, wallMaterials: design.wallMaterials,
    ceilingMaterial: design.ceilingMaterial, lighting: design.lighting,
  });
  const rooms = (design.rooms ?? []).map(room => room.id === activeRoomId ? active : cloneRoom(room));
  if (!rooms.some(room => room.id === activeRoomId)) rooms.unshift(active);
  return { ...design, activeRoomId, roomName: active.name, roomType: type, height: active.height,
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
