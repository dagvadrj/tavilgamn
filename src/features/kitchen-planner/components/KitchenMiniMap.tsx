"use client";

import { useSyncExternalStore, type KeyboardEvent } from "react";
import { roomOutline, roomOutlinePath } from "@/lib/kitchenRoomOutline";
import { cabinetCorners } from "@/lib/kitchenPlacement";
import { cabinetLabel, type ModularKitchen } from "@/lib/kitchenCabinets";
import type { KitchenCameraPoseStore, KitchenMapSide } from "@/lib/kitchenCameraPose";
import "./kitchen-mini-map.css";

/** Band around the room, in mm: room for the camera marker and the side buttons. */
const MARGIN = 420;
/** Camera marker: how far its view wedge reaches and how wide it opens. */
const WEDGE_LENGTH = 700;
const WEDGE_HALF_ANGLE = (28 * Math.PI) / 180;

const SIDE_LABEL: Record<KitchenMapSide, string> = {
  back: "Арын ханыг харах",
  front: "Урд ханыг харах",
  left: "Зүүн ханыг харах",
  right: "Баруун ханыг харах",
};
/** Facing a wall means standing on the opposite side: the cutaway opens that way. */
const OPPOSITE: Record<KitchenMapSide, KitchenMapSide> = { back: "front", front: "back", left: "right", right: "left" };

const noPose = () => null;
const noSubscribe = () => () => {};

/**
 * The room map beside the 3D view: walls, openings and cabinets as plain
 * shapes (no labels at this size), where the camera stands, and a band along
 * each wall that turns the 3D view to face that wall.
 */
export function KitchenMiniMap({
  kitchen,
  selectedId,
  missingIds,
  pose,
  onSelect,
  onView,
}: {
  kitchen: ModularKitchen;
  selectedId: string | null;
  /** Cabinets still waiting for a 3D model; drawn in the banner's amber. */
  missingIds: ReadonlySet<string>;
  pose?: KitchenCameraPoseStore;
  onSelect: (id: string) => void;
  /** The side the camera should stand on. */
  onView: (side: KitchenMapSide) => void;
}) {
  const camera = useSyncExternalStore(pose?.subscribe ?? noSubscribe, pose?.get ?? noPose, noPose);
  const { width, depth } = kitchen.room;
  const outline = roomOutlinePath(roomOutline(kitchen.room));
  const box = { x: -MARGIN, z: -MARGIN, w: width + MARGIN * 2, d: depth + MARGIN * 2 };
  const sides: [KitchenMapSide, number, number, number, number][] = [
    ["back", box.x, box.z, box.w, MARGIN],
    ["front", box.x, depth, box.w, MARGIN],
    ["left", box.x, 0, MARGIN, depth],
    ["right", width, 0, MARGIN, depth],
  ];
  // A camera outside the room is pinned to the band, pointing the way it looks.
  const marker = camera && {
    x: Math.min(width + MARGIN * 0.55, Math.max(-MARGIN * 0.55, camera.x)),
    z: Math.min(depth + MARGIN * 0.55, Math.max(-MARGIN * 0.55, camera.z)),
    angle: Math.atan2(camera.dirZ, camera.dirX),
  };
  const wedge = marker && [
    [marker.x, marker.z],
    [marker.x + Math.cos(marker.angle - WEDGE_HALF_ANGLE) * WEDGE_LENGTH, marker.z + Math.sin(marker.angle - WEDGE_HALF_ANGLE) * WEDGE_LENGTH],
    [marker.x + Math.cos(marker.angle + WEDGE_HALF_ANGLE) * WEDGE_LENGTH, marker.z + Math.sin(marker.angle + WEDGE_HALF_ANGLE) * WEDGE_LENGTH],
  ].map(([x, z]) => `${x},${z}`).join(" ");
  const press = (event: KeyboardEvent, action: () => void) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    action();
  };
  const cabinets = [...kitchen.cabinets].sort((a, b) => Number(a.type === "wall") - Number(b.type === "wall"));
  return (
    <svg
      className="kitchen-mini-map"
      viewBox={`${box.x} ${box.z} ${box.w} ${box.d}`}
      style={{ aspectRatio: `${box.w} / ${box.d}` }}
      role="group"
      aria-label="Өрөөний зураг: шүүгээ сонгох, хананы хажууд дарж тэр ханыг харах"
    >
      {sides.map(([side, x, z, w, h]) => (
        <rect
          key={side}
          className="kmm-side"
          x={x}
          y={z}
          width={w}
          height={h}
          role="button"
          tabIndex={0}
          aria-label={SIDE_LABEL[side]}
          onClick={() => onView(OPPOSITE[side])}
          onKeyDown={(event) => press(event, () => onView(OPPOSITE[side]))}
        >
          <title>{SIDE_LABEL[side]}</title>
        </rect>
      ))}
      <path d={outline} className="kmm-floor" />
      {(kitchen.room.items ?? [])
        .filter((item) => item.kind === "window" || item.kind === "door")
        .map((item) => {
          const along = item.wall === "left" || item.wall === "right";
          return (
            <line
              key={item.id}
              className={item.kind === "window" ? "kmm-window" : "kmm-door"}
              x1={along ? item.x : item.x - item.width / 2}
              x2={along ? item.x : item.x + item.width / 2}
              y1={along ? item.z - item.width / 2 : item.z}
              y2={along ? item.z + item.width / 2 : item.z}
            />
          );
        })}
      <path d={outline} className="kmm-walls" />
      {cabinets.map((cabinet) => {
        const state =
          selectedId === cabinet.id ? "selected" : missingIds.has(cabinet.id) ? "missing" : undefined;
        return (
          <polygon
            key={cabinet.id}
            className="kmm-cabinet"
            data-type={cabinet.type}
            data-state={state}
            points={cabinetCorners(cabinet).map((p) => `${p.x},${p.z}`).join(" ")}
            role="button"
            tabIndex={0}
            aria-label={cabinetLabel(cabinet)}
            aria-pressed={selectedId === cabinet.id}
            onClick={() => onSelect(cabinet.id)}
            onKeyDown={(event) => press(event, () => onSelect(cabinet.id))}
          />
        );
      })}
      {(kitchen.extras ?? []).map((extra) => (
        <polygon
          key={extra.id}
          className="kmm-extra"
          data-state={selectedId === extra.id ? "selected" : undefined}
          points={cabinetCorners(extra).map((p) => `${p.x},${p.z}`).join(" ")}
          onClick={() => onSelect(extra.id)}
        />
      ))}
      {marker && (
        <g className="kmm-camera" pointerEvents="none" aria-hidden="true">
          <polygon points={wedge ?? ""} />
          <circle cx={marker.x} cy={marker.z} r={95} />
        </g>
      )}
    </svg>
  );
}
