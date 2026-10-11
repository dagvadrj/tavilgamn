import type { DesignRoom, RoomWall } from "./types";
import {
  createOpening,
  validateRoomOpenings,
  wallLength,
} from "./roomOpenings";
import { validateRoomSetup } from "./roomSetup";

export interface AddRoomOptions {
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
    connectionKind: options.door ? ("door" as const) : ("open" as const),
    openings: [
      options.door ? createOpening("door-single", options.doorWall) : null,
      options.window ? createOpening("window-fixed", options.windowWall) : null,
    ].filter((item) => item !== null),
  };
  if (
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
