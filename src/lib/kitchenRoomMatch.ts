import type { KitchenDesignSummary } from "./kitchenMarketplace";

export type KitchenBuyerRoom = { widthMm: number; depthMm: number };
export type KitchenRoomMatch = { fits: boolean; overMm: number; label: string };

const ROOM_MIN = 1000, ROOM_MAX = 20000;

/** Reads `w`/`d` (mm) search params; anything implausible means "no room given". */
export function parseKitchenBuyerRoom(w?: string, d?: string): KitchenBuyerRoom | null {
  const widthMm = Math.round(Number(w)), depthMm = Math.round(Number(d));
  const ok = (value: number) => Number.isFinite(value) && value >= ROOM_MIN && value <= ROOM_MAX;
  return ok(widthMm) && ok(depthMm) ? { widthMm, depthMm } : null;
}

/** Floor space the design needs: a GLB's outer size, otherwise the room it was drawn for. */
export function kitchenFootprint(design: Pick<KitchenDesignSummary, "model" | "roomWidthMm" | "roomDepthMm">) {
  return design.model
    ? { widthMm: design.model.widthMm, depthMm: design.model.depthMm }
    : { widthMm: design.roomWidthMm, depthMm: design.roomDepthMm };
}

/** A kitchen may be turned to either wall, so the better orientation counts. */
export function matchKitchenToRoom(
  design: Pick<KitchenDesignSummary, "model" | "roomWidthMm" | "roomDepthMm">,
  room: KitchenBuyerRoom,
): KitchenRoomMatch {
  const need = kitchenFootprint(design);
  const over = (w: number, d: number) => Math.max(0, need.widthMm - w) + Math.max(0, need.depthMm - d);
  const overMm = Math.min(over(room.widthMm, room.depthMm), over(room.depthMm, room.widthMm));
  return overMm === 0
    ? { fits: true, overMm, label: "Таны өрөөнд таарна" }
    : { fits: false, overMm, label: `${overMm} мм илүү` };
}

/** Fitting designs first, then the ones closest to fitting; otherwise original order. */
export function sortByRoomMatch<T extends Pick<KitchenDesignSummary, "model" | "roomWidthMm" | "roomDepthMm">>(
  designs: T[],
  room: KitchenBuyerRoom,
) {
  return designs
    .map((design, index) => ({ design, index, match: matchKitchenToRoom(design, room) }))
    .sort((a, b) => a.match.overMm - b.match.overMm || a.index - b.index);
}
