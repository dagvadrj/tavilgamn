import type { DesignRoom, RoomDesign, RoomType } from "./types";
import { ROOM_TYPES } from "./roomGeometry";

export function cloneRoom(room: DesignRoom): DesignRoom {
  return { ...room, height: room.height ?? 2.7,
    pieces: room.pieces.map(piece => ({ ...piece })),
    wallFeatures: (room.wallFeatures ?? []).map(feature => ({ ...feature })),
    columns: (room.columns ?? []).map(column => ({ ...column })),
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
  });
  const rooms = (design.rooms ?? []).map(room => room.id === activeRoomId ? active : cloneRoom(room));
  if (!rooms.some(room => room.id === activeRoomId)) rooms.unshift(active);
  return { ...design, activeRoomId, roomName: active.name, roomType: type, height: active.height,
    wallFeatures: active.wallFeatures, columns: active.columns, pieces: active.pieces, rooms };
}

export function activateDesignRoom(design: RoomDesign, id: string): RoomDesign {
  const synced = syncDesignRooms(design);
  const room = synced.rooms!.find(item => item.id === id);
  if (!room) return synced;
  return { ...synced, activeRoomId: room.id, roomName: room.name, roomType: room.type,
    width: room.width, depth: room.depth, height: room.height,
    wallColor: room.wallColor, floorColor: room.floorColor, pieces: room.pieces,
    wallFeatures: room.wallFeatures, columns: room.columns,
  };
}

export function newDesignRoom(type: RoomType, existing: DesignRoom[]): DesignRoom {
  const preset = ROOM_TYPES[type];
  const count = existing.filter(room => room.type === type).length;
  return { id: `room_${crypto.randomUUID()}`, name: preset.label + (count ? ` ${count + 1}` : ""), type,
    width: preset.width, depth: preset.depth, height: 2.7, wallColor: "#EFE6D6", floorColor: "#C9A37A",
    pieces: [], wallFeatures: [], columns: [],
  };
}
