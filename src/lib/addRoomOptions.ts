import type { DesignRoom, RoomWall, RoomOpening, WallFeature, RoomVertex, RoomSurfaces } from "./types";
import {
  createOpening,
  validateRoomOpenings,
  wallLength,
} from "./roomOpenings";
import { validateRoomSetup } from "./roomSetup";
import type { FurnishingOptions } from "./roomFurnishing";

export interface AddRoomOptions extends FurnishingOptions, Partial<RoomSurfaces> {
  outline?: RoomVertex[];
  wallColor?: string;
  floorColor?: string;
  openings?: RoomOpening[];
  wallFeatures?: WallFeature[];
  name: string;
  width: number;
  depth: number;
  height: number;
  door: boolean;
  window: boolean;
  doorWall: RoomWall;
  windowWall: RoomWall;
}
export function configureAddedRoom(
  room: DesignRoom,
  options: AddRoomOptions,
): DesignRoom {
  const error = validateRoomSetup(options);
  if (error) throw new Error(error);
  const configured = {
    ...room,
    name: options.name.trim() || room.name,
    width: options.width,
    depth: options.depth,
    height: options.height,
    outline: options.outline,
    wallColor: options.wallColor ?? room.wallColor,
    floorColor: options.floorColor ?? room.floorColor,
    floorMaterial: options.floorMaterial ?? room.floorMaterial,
    wallMaterials: options.wallMaterials ?? room.wallMaterials,
    wallFeatures: options.wallFeatures ?? room.wallFeatures,
    connectionKind: (options.openings ? options.openings.some(o => o.kind === "door") : options.door) ? ("door" as const) : ("open" as const),
    openings: options.openings?.map(opening => ({ ...opening })) ?? [
      options.door ? createOpening("door-single", options.doorWall) : null,
      options.window ? createOpening("window-fixed", options.windowWall) : null,
    ].filter((item) => item !== null),
  };
  if (
    !options.openings &&
    configured.openings.length === 2 &&
    options.doorWall === options.windowWall
  ) {
    const [door, window] = configured.openings;
    const length = wallLength(configured, options.doorWall);
    const span = door.width + window.width + 0.24;
    door.position = (length / 2 - span / 2 + 0.06 + door.width / 2) / length;
    window.position =
      (length / 2 + span / 2 - 0.06 - window.width / 2) / length;
  }
  const openingError = validateRoomOpenings(configured);
  if (openingError) throw new Error(openingError);
  return configured;
}
