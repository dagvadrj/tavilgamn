"use client";
import { useMemo, useState } from "react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import {
  KITCHEN_WALLS,
  wallElevation,
  type KitchenWallSide,
} from "@/lib/kitchenWorkspace";

const FILL: Record<string, string> = { base: "#dfe6ee", wall: "#eef2f6", tall: "#d5dde7" };

/**
 * K5 «Ханын зураг»: one wall drawn to scale from the saved design, so it is
 * real data, not a render. Pressing a module selects the same instance the
 * 3D scene and the plan select.
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
  const [side, setSide] = useState<KitchenWallSide>("back");
  const view = useMemo(
    () => wallElevation(kitchen.room, kitchen.cabinets, side),
    [kitchen.room, kitchen.cabinets, side],
  );
  const height = kitchen.room.height;
  const pad = 260;
  const box = `${-pad} ${-pad / 2} ${view.length + pad * 2} ${height + pad * 1.4}`;
  const y = (mm: number) => height - mm;
  const letter = KITCHEN_WALLS.find((wall) => wall.side === side)!.letter;
  return (
    <div className="kitchen-k-elevation">
      <div className="kitchen-k-segmented" role="group" aria-label="Хана сонгох">
        {KITCHEN_WALLS.map((wall) => (
          <button
            key={wall.side}
            type="button"
            aria-pressed={wall.side === side}
            onClick={() => setSide(wall.side)}
          >
            {wall.letter} хана
          </button>
        ))}
      </div>
      <svg
        viewBox={box}
        role="img"
        aria-label={`${letter} хананы зураг · ${view.length} мм`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x={0} y={0} width={view.length} height={height} className="kitchen-k-elev-wall" />
        <line x1={-pad / 2} x2={view.length + pad / 2} y1={height} y2={height} className="kitchen-k-elev-floor" />
        {view.openings.map((opening) => (
          <rect
            key={opening.id}
            x={opening.start}
            y={y(opening.top)}
            width={opening.end - opening.start}
            height={opening.top - opening.bottom}
            className={`kitchen-k-elev-${opening.kind}`}
          />
        ))}
        {view.pieces.map((piece) => (
          <rect
            key={piece.id}
            x={piece.start}
            y={y(piece.top)}
            width={piece.end - piece.start}
            height={piece.top - piece.bottom}
            fill={FILL[piece.type] ?? "#e4e8ee"}
            className="kitchen-k-elev-piece"
            data-selected={piece.id === selectedId || undefined}
          />
        ))}
        <text x={view.length / 2} y={height + pad * 0.55} textAnchor="middle" className="kitchen-k-elev-dim">
          {letter} хана · {view.length} мм
        </text>
        <text x={-pad * 0.45} y={height / 2} textAnchor="middle" className="kitchen-k-elev-dim" transform={`rotate(-90 ${-pad * 0.45} ${height / 2})`}>
          {height} мм
        </text>
      </svg>
      {/* Real buttons over the drawing keep keyboard selection possible. */}
      <ul className="kitchen-k-elev-list" aria-label={`${letter} хананы модулиуд`}>
        {view.pieces.map((piece) => (
          <li key={piece.id}>
            <button
              type="button"
              aria-pressed={piece.id === selectedId}
              onClick={() => onSelect(piece.id)}
            >
              {kitchen.cabinets.find((cabinet) => cabinet.id === piece.id)?.width} мм ·{" "}
              {piece.start}–{piece.end} мм
            </button>
          </li>
        ))}
        {!view.pieces.length && <li className="kitchen-k-empty">Энэ хананд модуль алга.</li>}
      </ul>
    </div>
  );
}
