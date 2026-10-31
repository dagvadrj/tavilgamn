"use client";

import { Check } from "lucide-react";
import { DEFAULT_FLOOR_MATERIAL } from "@/lib/roomDesign";
import { DEFAULT_KITCHEN_WALL_COLOR } from "@/lib/kitchenSpace";
import { KITCHEN_FLOOR_MATERIALS, KITCHEN_WALL_PAINTS } from "@/lib/kitchenRoomFinishes";
import { roomWalls, type KitchenRoom } from "@/lib/kitchenCabinets";
import "./kitchen-room-finishes.css";

/**
 * «Өрөө» in the Materials tab: the floor and one paint for every wall, picked
 * from swatches beside the cabinet finishes they have to sit with. A wall-by-
 * wall paint stays in the room step.
 */
export function KitchenRoomFinishes({
  room,
  disabled,
  onChange,
  onRoomStep,
}: {
  room: KitchenRoom;
  disabled: boolean;
  onChange: (room: KitchenRoom) => void;
  onRoomStep: () => void;
}) {
  const floor = room.floorMaterial ?? DEFAULT_FLOOR_MATERIAL;
  type PaintWall = keyof NonNullable<KitchenRoom["wallColors"]>;
  // Paint is saved per named side; outline walls report the side they came from.
  const walls = [...new Set(roomWalls(room).map((wall) => wall.sourceWall ?? wall.id))].filter(
    (wall): wall is PaintWall => ["back", "front", "left", "right"].includes(wall),
  );
  const colors = new Set(walls.map((wall) => (room.wallColors?.[wall] ?? DEFAULT_KITCHEN_WALL_COLOR).toLowerCase()));
  // One paint shows as chosen only while every wall carries it.
  const paint = colors.size === 1 ? [...colors][0] : null;
  return (
    <section className="kitchen-room-finishes" aria-labelledby="kitchen-room-finishes-heading">
      <h3 id="kitchen-room-finishes-heading">Өрөө</h3>
      <fieldset disabled={disabled}>
        <legend>Шал</legend>
        <div className="krf-swatches" role="radiogroup" aria-label="Шалны материал">
          {KITCHEN_FLOOR_MATERIALS.map((material) => (
            <button
              key={material.id}
              type="button"
              role="radio"
              aria-checked={floor === material.id}
              title={`${material.label} · ${material.description}`}
              onClick={() => floor !== material.id && onChange({ ...room, floorMaterial: material.id })}
            >
              <span className="krf-swatch" style={{ background: material.swatch }} aria-hidden="true">
                {floor === material.id && <Check size={14} />}
              </span>
              <small>{material.label}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={disabled}>
        <legend>Хана</legend>
        <div className="krf-swatches is-paint" role="radiogroup" aria-label="Бүх ханын өнгө">
          {KITCHEN_WALL_PAINTS.map(({ color, label }) => (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={paint === color}
              title={label}
              onClick={() =>
                paint !== color &&
                onChange({ ...room, wallColors: Object.fromEntries(walls.map((wall) => [wall, color])) })
              }
            >
              <span className="krf-swatch" style={{ background: color }} aria-hidden="true">
                {paint === color && <Check size={14} />}
              </span>
              <small>{label}</small>
            </button>
          ))}
        </div>
        <p className="krf-note">
          {paint ? "Бүх хананд нэг өнгө." : "Хана тус бүр өөр өнгөтэй."}{" "}
          <button type="button" onClick={onRoomStep}>
            Хана тус бүрээр будах
          </button>
        </p>
      </fieldset>
    </section>
  );
}
