import type { RoomType } from "./types";
import { ROOM_TYPES } from "./roomGeometry";

export interface RoomSetupDimensions {
  width: number;
  depth: number;
  height: number;
}

/** Starting examples, not claims about building standards or available properties. */
export const ROOM_SIZE_SUGGESTIONS: Record<RoomType, { width: number; depth: number }[]> = {
  living: [{ width: 4, depth: 3 }, { width: 4, depth: 4 }, { width: 5, depth: 4 }, { width: 6, depth: 5 }],
  bedroom: [{ width: 3, depth: 3 }, { width: 4, depth: 3 }, { width: 4, depth: 3.5 }, { width: 5, depth: 4 }],
  kitchen: [{ width: 3, depth: 2 }, { width: 3, depth: 3 }, { width: 3.5, depth: 3 }, { width: 4, depth: 4 }],
  bathroom: [{ width: 2, depth: 2 }, { width: 2.5, depth: 2 }, { width: 3, depth: 2 }, { width: 4, depth: 2 }],
  office: [{ width: 3, depth: 2 }, { width: 3, depth: 3 }, { width: 3.5, depth: 3 }, { width: 4, depth: 4 }],
  other: [{ width: 3, depth: 3 }, { width: 4, depth: 3 }, { width: 4, depth: 4 }, { width: 6, depth: 4 }],
};

export function suggestedRoomIndex(type: RoomType) {
  const room = ROOM_TYPES[type];
  return ROOM_SIZE_SUGGESTIONS[type].findIndex(size => size.width === room.width && size.depth === room.depth);
}

export function validateRoomSetup(dimensions: RoomSetupDimensions): string | null {
  if (![dimensions.width, dimensions.depth].every(value => Number.isFinite(value) && value >= 1 && value <= 20))
    return "Өргөн, урт тус бүр 100–2000 см байна.";
  if (!Number.isFinite(dimensions.height) || dimensions.height < 2.4 || dimensions.height > 3)
    return "Таазны өндөр 240–300 см байна.";
  return null;
}

export const roomSetupNumber = (value: number) => Number(value.toFixed(2)).toString();
