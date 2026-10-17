import type {
  DesignRoom,
  RoomDesign,
  RoomType,
  RoomLighting,
  RoomSurfaces,
  RoomWall,
  WallMaterial,
  RoomShape,
} from "./types";
import { ROOM_TYPES } from "./roomGeometry";
import { positionedRooms, validConnections } from "./roomLayout";
import { automaticCeilingFixtures, normalizeRoomCeiling } from "./roomCeiling";
import { normalizeSunBearing } from "./roomSunlight";
import { interiorCamera } from "./roomInteriorCamera";
import { lightingTime } from "./roomLighting";

export const DEFAULT_FLOOR_MATERIAL = "parquet-oak";
/** Old saved floor colours keep their appearance until a library material is chosen. */
export const LEGACY_FLOOR_MATERIAL = "legacy";
export const DEFAULT_CEILING_MATERIAL = "ceiling-white";
export const DEFAULT_ROOM_LIGHTING: RoomLighting = {
  mode: "day",
  timeOfDay: 12,
  autoLights: true,
  ambient: 0.65,
  sunlight: 1.8,
  fixtures: [],
};
const WALLS: RoomWall[] = ["north", "east", "south", "west"];

/** Each saved room owns all nested surface state, including fixture positions. */
function cloneSurfaces(
  room: RoomSurfaces & {
    wallColor?: string;
    id?: string;
    width?: number;
    depth?: number;
    outline?: RoomShape["outline"];
  },
): RoomSurfaces {
  const wallMaterials: Partial<Record<RoomWall, WallMaterial>> = {};
  for (const wall of WALLS)
    wallMaterials[wall] = {
      mode: "color",
      color: room.wallColor ?? "#EFE6D6",
      ...room.wallMaterials?.[wall],
    };
  const savedFixtures = room.lighting?.fixtures;
  const legacyDefault = savedFixtures?.length === 1 && savedFixtures[0].id === `ceiling-${room.id}` && !savedFixtures[0].kind && savedFixtures[0].intensity === 18 && savedFixtures[0].color === "#ffe3b3" && savedFixtures[0].x === 0 && savedFixtures[0].z === 0;
  const autoLayout = room.lighting?.fixtureLayout === "auto" || (room.lighting?.fixtureLayout !== "manual" && (legacyDefault || !savedFixtures || (savedFixtures.length === 0 && room.lighting?.autoLights === undefined)));
  const lighting: RoomLighting = {
    ...DEFAULT_ROOM_LIGHTING,
    ...room.lighting,
    timeOfDay: lightingTime(room.lighting),
    fixtureLayout: autoLayout ? "auto" : "manual",
    fixtures: autoLayout && room.id && room.width && room.depth
      ? automaticCeilingFixtures(room as RoomShape, room.id)
      : (savedFixtures ?? []).map(fixture => ({ ...fixture })),
  };
  if (Number.isFinite(lighting.sunAzimuth))
    lighting.sunAzimuth = normalizeSunBearing(lighting.sunAzimuth!);
  else delete lighting.sunAzimuth;
  if (Number.isFinite(lighting.sunElevation))
    lighting.sunElevation = Math.max(5, Math.min(75, lighting.sunElevation!));
  else delete lighting.sunElevation;
  return {
    floorMaterial: room.floorMaterial ?? LEGACY_FLOOR_MATERIAL,
    ceilingMaterial: room.ceilingMaterial ?? DEFAULT_CEILING_MATERIAL,
    ceiling: normalizeRoomCeiling(
      room.ceiling,
      room.width && room.depth
        ? { width: room.width, depth: room.depth }
        : undefined,
    ),
    wallMaterials,
    lighting,
  };
}

export function cloneRoom(room: DesignRoom): DesignRoom {
  const cloned = {
    ...room,
    height: room.height ?? 2.7,
    ...cloneSurfaces(room),
    interiorCamera: interiorCamera(room),
    pieces: room.pieces.map((piece) => ({
      ...piece,
      ...(piece.attachment ? { attachment: structuredClone(piece.attachment) } : {}),
      ...(piece.placement ? { placement: structuredClone(piece.placement) } : {}),
      ...(piece.details
        ? {
            details: {
              ...piece.details,
              dimensions: { ...piece.details.dimensions },
            },
          }
        : {}),
      ...(piece.kitchen
        ? { kitchen: JSON.parse(JSON.stringify(piece.kitchen)) }
        : {}),
    })),
    outline: room.outline?.map(point => ({ ...point })),
    wallFeatures: (room.wallFeatures ?? []).map((feature) => ({ ...feature })),
    columns: (room.columns ?? []).map((column) => ({ ...column })),
    openings: (room.openings ?? []).map((opening) => ({ ...opening })),
  };
  if (cloned.connectionKind === undefined) delete cloned.connectionKind;
  if (cloned.outline === undefined) delete cloned.outline;
  return cloned;
}

/** Migrate old single-room saves while keeping the active-room cache in sync. */
export function syncDesignRooms(design: RoomDesign): RoomDesign {
  const activeRoomId = design.activeRoomId ?? `${design.id}-room-1`;
  const type = design.roomType ?? "living";
  const active = cloneRoom({
    id: activeRoomId,
    name: design.roomName ?? ROOM_TYPES[type].label,
    type,
    width: design.width,
    depth: design.depth,
    height: design.height,
    position: design.rooms?.find((room) => room.id === activeRoomId)?.position,
    interiorCamera:
      design.interiorCamera ??
      design.rooms?.find((room) => room.id === activeRoomId)?.interiorCamera,
    connectionKind:
      design.connectionKind ??
      design.rooms?.find((room) => room.id === activeRoomId)?.connectionKind,
    wallColor: design.wallColor,
    floorColor: design.floorColor,
    pieces: design.pieces,
    outline: design.outline,
    wallFeatures: design.wallFeatures,
    columns: design.columns,
    openings: design.openings,
    floorMaterial: design.floorMaterial,
    wallMaterials: design.wallMaterials,
    ceilingMaterial: design.ceilingMaterial,
    ceiling: design.ceiling,
    lighting: design.lighting,
  });
  let rooms = (design.rooms ?? []).map((room) =>
    room.id === activeRoomId ? active : cloneRoom(room),
  );
  if (!rooms.some((room) => room.id === activeRoomId)) rooms.unshift(active);
  rooms = positionedRooms(rooms).map((room) => {
    const lighting = {
      ...room.lighting!,
      timeOfDay: lightingTime(active.lighting),
      mode: active.lighting!.mode,
    };
    delete lighting.sunAzimuth;
    delete lighting.sunElevation;
    if (active.lighting!.sunAzimuth !== undefined)
      lighting.sunAzimuth = active.lighting!.sunAzimuth;
    if (active.lighting!.sunElevation !== undefined)
      lighting.sunElevation = active.lighting!.sunElevation;
    return { ...room, lighting };
  });
  const next = {
    ...design,
    connections: validConnections(rooms, design.connections ?? []),
    activeRoomId,
    roomName: active.name,
    roomType: type,
    height: active.height,
    interiorCamera: active.interiorCamera,
    connectionKind: active.connectionKind,
    outline: active.outline,
    wallFeatures: active.wallFeatures,
    columns: active.columns,
    openings: active.openings,
    ...cloneSurfaces(active),
    pieces: active.pieces,
    rooms,
  };
  if (next.connectionKind === undefined) delete next.connectionKind;
  if (next.outline === undefined) delete next.outline;
  return next;
}

export function activateDesignRoom(design: RoomDesign, id: string): RoomDesign {
  const synced = syncDesignRooms(design);
  const room = synced.rooms!.find((item) => item.id === id);
  if (!room) return synced;
  const next = {
    ...synced,
    activeRoomId: room.id,
    roomName: room.name,
    roomType: room.type,
    width: room.width,
    depth: room.depth,
    height: room.height,
    wallColor: room.wallColor,
    floorColor: room.floorColor,
    pieces: room.pieces,
    interiorCamera: room.interiorCamera,
    connectionKind: room.connectionKind,
    outline: room.outline,
    wallFeatures: room.wallFeatures,
    columns: room.columns,
    openings: room.openings,
    ...cloneSurfaces(room),
  };
  if (next.connectionKind === undefined) delete next.connectionKind;
  if (next.outline === undefined) delete next.outline;
  return next;
}

export function newDesignRoom(
  type: RoomType,
  existing: DesignRoom[],
): DesignRoom {
  const preset = ROOM_TYPES[type];
  const count = existing.filter((room) => room.type === type).length;
  return cloneRoom({
    id: `room_${crypto.randomUUID()}`,
    name: preset.label + (count ? ` ${count + 1}` : ""),
    type,
    width: preset.width,
    depth: preset.depth,
    height: 2.7,
    wallColor: "#EFE6D6",
    floorColor: "#C9A37A",
    floorMaterial: DEFAULT_FLOOR_MATERIAL,
    pieces: [],
    wallFeatures: [],
    columns: [],
  });
}
