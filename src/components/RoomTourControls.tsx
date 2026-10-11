"use client";
import type { ReactNode } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react";
import type { RoomDesign } from "@/lib/types";
import {
  clampTourFov,
  MIN_TOUR_FOV,
  MAX_TOUR_FOV,
  type WalkDirection,
} from "@/lib/roomInteriorCamera";

export function RoomTourControls({
  design,
  locked,
  onSelectRoom,
  onExit,
  onFov,
  onWalk,
  beginEdit,
  endEdit,
}: {
  design: RoomDesign;
  locked: boolean;
  onSelectRoom: (id: string) => void;
  onExit: () => void;
  onFov: (fov: number) => void;
  onWalk: (direction: WalkDirection | null) => void;
  beginEdit: () => void;
  endEdit: () => void;
}) {
  const fov = clampTourFov(design.interiorCamera?.fov);
  const button = (
    direction: WalkDirection,
    label: string,
    icon: ReactNode,
    position: string,
  ) => (
    <button
      type="button"
      disabled={locked}
      aria-label={label}
      title={`${label} · дарж барина`}
      className={`${position} flex h-11 w-11 items-center justify-center rounded-lg bg-white shadow disabled:opacity-40`}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        onWalk(direction);
      }}
      onPointerUp={() => onWalk(null)}
      onPointerCancel={() => onWalk(null)}
      onLostPointerCapture={() => onWalk(null)}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          onWalk(direction);
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") onWalk(null);
      }}
      onBlur={() => onWalk(null)}
    >
      {icon}
    </button>
  );
  return (
    <>
      <div className="absolute right-20 top-24 z-20 w-[min(320px,calc(100%-100px))] rounded-xl bg-white/95 p-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">
            Камер{" "}
            <select
              aria-label="Өрөөний камер сонгох"
              className="min-w-0 flex-1 rounded-lg border p-2"
              value={design.activeRoomId}
              onChange={(e) => onSelectRoom(e.target.value)}
            >
              {design.rooms?.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="text-xs underline" onClick={onExit}>
            Өрөөний харагдац
          </button>
        </div>
        <label className="mt-3 block text-xs">
          Харах өнцөг: {Math.round(fov)}°
          <input
            aria-label="Камерын харах өнцөг"
            className="mt-2 block w-full"
            type="range"
            min={MIN_TOUR_FOV}
            max={MAX_TOUR_FOV}
            step={1}
            value={fov}
            disabled={locked}
            onPointerDown={beginEdit}
            onPointerUp={endEdit}
            onPointerCancel={endEdit}
            onBlur={endEdit}
            onKeyDown={beginEdit}
            onKeyUp={endEdit}
            onChange={(event) => onFov(Number(event.target.value))}
          />
        </label>
        <p className="mt-2 text-xs text-gray-600">
          W/A/S/D — алхах · Чирэх — эргэн харах
        </p>
      </div>
      <div
        className="absolute bottom-44 left-4 z-20 rounded-xl bg-white/75 p-2 shadow-lg"
        role="group"
        aria-label="Өрөө дотор алхах"
      >
        <div className="grid grid-cols-3 gap-1">
          {button(
            "forward",
            "Урагш алхах",
            <ArrowUp size={20} />,
            "col-start-2",
          )}
          {button(
            "left",
            "Зүүн тийш алхах",
            <ArrowLeft size={20} />,
            "col-start-1 row-start-2",
          )}
          {button(
            "backward",
            "Хойш алхах",
            <ArrowDown size={20} />,
            "col-start-2 row-start-2",
          )}
          {button(
            "right",
            "Баруун тийш алхах",
            <ArrowRight size={20} />,
            "col-start-3 row-start-2",
          )}
        </div>
      </div>
    </>
  );
}
