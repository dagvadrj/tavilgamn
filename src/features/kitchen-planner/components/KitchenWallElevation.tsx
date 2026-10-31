"use client";
import { useMemo } from "react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import { KITCHEN_WALLS, wallElevation } from "@/lib/kitchenWorkspace";
import { SideView25D, type SideViewBox, type SideViewOpening } from "@/features/planner/components/SideView25D";

const mm = (metres: number) => `${Math.round(metres * 1000)} мм`;

/**
 * K5 «Ханын зураг», now seen from the side in 2.5D: pick one of the four walls
 * and look at it from inside the room, true to scale and drawn from the saved
 * design (not a render). Pressing a module selects the same instance the 3D
 * scene and the plan select; the list below keeps keyboard selection.
 */
export function KitchenWallElevation({
  kitchen,
  selectedId,
  onSelect,
}: {
  kitchen: ModularKitchen;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { room } = kitchen;
  const boxes = useMemo<SideViewBox[]>(
    () =>
      kitchen.cabinets.map((cabinet) => ({
        id: cabinet.id,
        x: cabinet.position.x / 1000,
        z: cabinet.position.z / 1000,
        y: cabinet.position.y / 1000,
        width: cabinet.width / 1000,
        depth: cabinet.depth / 1000,
        height: cabinet.height / 1000,
        rotation: cabinet.position.rotation,
        color: cabinet.color,
      })),
    [kitchen.cabinets],
  );
  const openings = useMemo<SideViewOpening[]>(
    () =>
      (room.items ?? []).flatMap((item) => {
        if (item.kind !== "door" && item.kind !== "window") return [];
        const bottom = item.kind === "door" ? 0 : item.sillHeight ?? 900;
        return [{
          id: item.id,
          kind: item.kind,
          wall: item.wall,
          centre: (item.wall === "back" || item.wall === "front" ? item.x : item.z) / 1000,
          width: item.width / 1000,
          bottom: bottom / 1000,
          top: (bottom + (item.height ?? (item.kind === "door" ? 2100 : 1100))) / 1000,
        }];
      }),
    [room.items],
  );
  return (
    <div className="kitchen-k-elevation">
      <SideView25D
        width={room.width / 1000}
        depth={room.depth / 1000}
        height={room.height / 1000}
        boxes={boxes}
        openings={openings}
        wallColor={room.wallColors?.back ?? "#ece8e1"}
        selectedId={selectedId}
        onSelect={onSelect}
        measure={mm}
        footer={(side) => {
          const view = wallElevation(room, kitchen.cabinets, side);
          const letter = KITCHEN_WALLS.find((wall) => wall.side === side)!.letter;
          return (
            <ul className="kitchen-k-elev-list" aria-label={`${letter} хананы модулиуд`}>
              {view.pieces.map((piece) => (
                <li key={piece.id}>
                  <button type="button" aria-pressed={piece.id === selectedId} onClick={() => onSelect(piece.id)}>
                    {kitchen.cabinets.find((cabinet) => cabinet.id === piece.id)?.width} мм · {piece.start}–{piece.end} мм
                  </button>
                </li>
              ))}
              {!view.pieces.length && <li className="kitchen-k-empty">Энэ хананд модуль алга.</li>}
            </ul>
          );
        }}
      />
    </div>
  );
}
