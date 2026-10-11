"use client";
import { useEffect, useRef } from "react";
import { RoomEnvironmentPanel } from "./RoomEnvironmentPanel";
import type { RoomDesign, RoomWall } from "@/lib/types";
export type SurfaceSelection = {
  surface: "wall" | "floor" | "ceiling";
  wall?: RoomWall;
  x: number;
  y: number;
};
export function RoomSurfacePopover({
  selection,
  design,
  onClose,
  onUpdate,
  onSurfaceChange,
  onSelectWall,
  beginEdit,
  endEdit,
}: {
  onSurfaceChange: (surface: SurfaceSelection["surface"]) => void;
  onSelectWall: (wall: RoomWall | null) => void;
  selection: SurfaceSelection;
  design: RoomDesign;
  onClose: () => void;
  onUpdate: (patch: Partial<RoomDesign>) => void;
  beginEdit: () => void;
  endEdit: () => void;
}) {
  const root = useRef<HTMLElement>(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    root.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close.current();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close.current();
      }
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("keydown", escape, true);
      endEdit();
      previous?.focus?.();
    };
  }, [endEdit]);
  const width = Math.min(340, window.innerWidth - 24),
    height = Math.min(560, window.innerHeight - 100);
  return (
    <section
      ref={root}
      role="dialog"
      aria-label="Гадаргуу засах"
      className="room-surface-popover"
      style={{
        left: Math.max(
          12,
          Math.min(selection.x, window.innerWidth - width - 12),
        ),
        top: Math.max(
          72,
          Math.min(selection.y, window.innerHeight - height - 12),
        ),
      }}
    >
      <header>
        <strong>
          {{ wall: "Хана", floor: "Шал", ceiling: "Тааз" }[selection.surface]}{" "}
          засах
        </strong>
        <button
          type="button"
          aria-label="Гадаргууны цонхыг хаах"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <RoomEnvironmentPanel
        design={design}
        tab="surfaces"
        surface={selection.surface}
        onSurfaceChange={onSurfaceChange}
        selectedWall={selection.wall ?? null}
        onSelectWall={onSelectWall}
        selectedOpening={null}
        onSelectOpening={() => {}}
        placementTemplate={null}
        onArmPlacement={() => {}}
        onAddOpening={() => {}}
        onUpdateOpening={() => {}}
        onUpdate={onUpdate}
        onHeight={(height) => onUpdate({ height })}
        onNotice={() => {}}
        beginEdit={beginEdit}
        endEdit={endEdit}
      />
    </section>
  );
}
