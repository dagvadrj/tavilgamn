"use client";

import { useMemo } from "react";
import type { RoomDesign, RoomWall } from "@/lib/types";
import { openingWorldTransform, validateOpening } from "@/lib/roomOpenings";
import { dimsFor, pieceRects } from "@/three/collision";
import { SideView25D, type SideViewBox, type SideViewOpening, type SideViewWall } from "@/features/planner/components/SideView25D";
import { useRoomMeasureUnit } from "./RoomMeasureUnit";

const WALL: Record<RoomWall, SideViewWall> = { north: "back", east: "right", south: "front", west: "left" };
const hex = (color: string, fallback: string) => (/^#[0-9a-f]{3,6}$/i.test(color) ? color : fallback);

/** The active room's four walls seen from the side in 2.5D, drawn from the saved design. */
export function RoomSideView25D({
  room,
  selectedId,
  onSelect,
}: {
  room: RoomDesign;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const unit = useRoomMeasureUnit((state) => state.unit);
  const { width, depth } = room;
  const height = room.height ?? 2.7;
  const boxes = useMemo<SideViewBox[]>(
    () =>
      room.pieces.flatMap((piece) => {
        const { h } = dimsFor(piece);
        // Room coordinates are centred; the side view counts from the back-left corner.
        return pieceRects(piece).map((rect, index) => ({
          id: piece.instanceId,
          x: rect.cx + width / 2,
          z: rect.cz + depth / 2,
          y: piece.elevation ?? 0,
          width: rect.w,
          depth: rect.d,
          height: h,
          rotation: -rect.rot,
          color: hex(piece.color, "#b9a48a"),
          label: index === 0 ? piece.details?.name : undefined,
        }));
      }),
    [room.pieces, width, depth],
  );
  const openings = useMemo<SideViewOpening[]>(
    () =>
      (room.openings ?? []).flatMap((opening) => {
        if (validateOpening(room, opening)) return [];
        const wall = WALL[opening.wallId];
        const world = openingWorldTransform(room, opening);
        const bottom = opening.kind === "door" ? 0 : opening.sillHeight;
        return [{
          id: opening.id,
          kind: opening.kind,
          wall,
          centre: wall === "back" || wall === "front" ? world.x + width / 2 : world.z + depth / 2,
          width: opening.width,
          bottom,
          top: bottom + opening.height,
        }];
      }),
    [room, width, depth],
  );
  return (
    <SideView25D
      width={width}
      depth={depth}
      height={height}
      boxes={boxes}
      openings={openings}
      wallColor={hex(room.wallColor, "#ece8e1")}
      floorColor={hex(room.floorColor, "#cdb79a")}
      selectedId={selectedId}
      onSelect={onSelect}
      measure={(metres) => `${Number((metres * (unit === "мм" ? 1000 : 100)).toFixed(0))} ${unit}`}
    />
  );
}
