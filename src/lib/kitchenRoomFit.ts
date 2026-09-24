import type { KitchenSnapshot } from "./kitchenAssembly";
import { kitchenRoomPiece } from "./kitchenRoomPiece";
import type { PlacedFurniture, RoomShape } from "./types";
import { dimsFor, findFreePlacement } from "@/three/collision";

export type KitchenRoomFitCode =
  | "fits"
  | "ceiling"
  | "occupied"
  | "structure"
  | "footprint";

export type KitchenRoomFit = {
  code: KitchenRoomFitCode;
  message: string;
  placement: PlacedFurniture | null;
};

const QUARTER_TURN = Math.PI / 2;

function rotationLabel(rotation: number) {
  const turns = Math.round(rotation / QUARTER_TURN);
  const normalized = ((turns % 4) + 4) % 4;
  return normalized === 0 ? "" : `${normalized * 90}° эргүүлж `;
}

/** Try every wall-facing orientation before declaring that a kitchen cannot fit. */
export function findKitchenPlacement(
  saved: KitchenSnapshot,
  others: PlacedFurniture[],
  room: RoomShape,
  instanceId: string,
) {
  const piece = kitchenRoomPiece(saved, instanceId);
  for (const rotation of [0, QUARTER_TURN, Math.PI, -QUARTER_TURN]) {
    const placement = findFreePlacement({ ...piece, rotation }, others, room);
    if (placement) return placement;
  }
  return null;
}

export function assessKitchenRoomFit(
  saved: KitchenSnapshot,
  others: PlacedFurniture[],
  room: RoomShape,
  instanceId = "kitchen-fit-preview",
): KitchenRoomFit {
  const piece = kitchenRoomPiece(saved, instanceId);
  const requiredHeight = dimsFor(piece).h;
  const roomHeight = room.height ?? 2.7;
  if (requiredHeight > roomHeight + 1e-6) {
    return {
      code: "ceiling",
      placement: null,
      message: `Гарнитур ${Math.ceil(requiredHeight * 1000)} мм өндөр, харин өрөөний тааз ${Math.round(roomHeight * 1000)} мм байна.`,
    };
  }

  const placement = findKitchenPlacement(saved, others, room, instanceId);
  if (placement) {
    return {
      code: "fits",
      placement,
      message: `Бодит хэмжээгээр ${rotationLabel(placement.rotation)}байрлуулах сул зай олдлоо.`,
    };
  }

  if (findKitchenPlacement(saved, [], room, instanceId)) {
    return {
      code: "occupied",
      placement: null,
      message: "Хэмжээгээрээ багтана. Одоо байгаа тавилгууд сул байрлалыг хааж байна.",
    };
  }

  const clearStructure: RoomShape = {
    ...room,
    columns: [],
    wallFeatures: [],
  };
  if (
    ((room.columns?.length ?? 0) > 0 || (room.wallFeatures?.length ?? 0) > 0) &&
    findKitchenPlacement(saved, [], clearStructure, instanceId)
  ) {
    return {
      code: "structure",
      placement: null,
      message: "Өрөөний багана эсвэл ханын товгор хэсэг боломжит байрлалыг хааж байна.",
    };
  }

  return {
    code: "footprint",
    placement: null,
    message: "Өрөөний ашиглах өргөн эсвэл урт энэ гарнитурт хүрэлцэхгүй байна.",
  };
}
