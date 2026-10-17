import { FlipHorizontal2, FlipVertical2, RotateCw } from "lucide-react";
import { getRoomGeometry, roomPath } from "@/lib/roomGeometry";
import type { RoomBuilderDraft } from "@/lib/roomBuilderDraft";
import { wallUnitLabel, type WallDrawingUnit } from "@/lib/roomWallDrawing";

export function RoomDimensionSidebar({
  draft,
  selected,
  unit,
  onUnit,
  onTransform,
}: {
  draft: RoomBuilderDraft;
  selected: number;
  unit: WallDrawingUnit;
  onUnit: (unit: WallDrawingUnit) => void;
  onTransform: (transform: "flip-x" | "flip-z" | "rotate") => void;
}) {
  const walls = getRoomGeometry(draft).segments.filter((wall) => !wall.hole);
  const wall = walls[selected];
  return (
    <div className="room-dimensions-sidebar">
      <svg
        className="room-builder-mini-plan"
        viewBox={`${-draft.width / 2 - 0.5} ${-draft.depth / 2 - 0.5} ${draft.width + 1} ${draft.depth + 1}`}
        role="img"
        aria-label="Өрөөний хэлбэр, сонгосон хана"
      >
        <path
          d={roomPath(draft)}
          fill="#f5f5f4"
          stroke="#34383d"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {wall && (
          <line
            x1={wall.a.x}
            y1={wall.a.z}
            x2={wall.b.x}
            y2={wall.b.z}
            stroke="var(--site-accent)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {draft.outline?.map((point) => (
          <circle
            key={point.id}
            cx={point.x}
            cy={point.z}
            r={Math.max(draft.width, draft.depth) / 75}
            fill="white"
            stroke="#71717a"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="room-builder-unit-row">
        <span>Хэмжих нэгж</span>
        <div
          className="room-builder-unit-options"
          role="group"
          aria-label="Хэмжих нэгж"
        >
          {(["mm", "cm", "m"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={unit === value}
              onClick={() => onUnit(value)}
            >
              {wallUnitLabel[value]}
            </button>
          ))}
        </div>
      </div>
      <div className="room-builder-orientation">
        <strong>Өрөөний чиглэл</strong>
        <button type="button" onClick={() => onTransform("flip-x")}>
          <FlipHorizontal2 size={17} /> Хэвтээ эргүүлэх
        </button>
        <button type="button" onClick={() => onTransform("flip-z")}>
          <FlipVertical2 size={17} /> Босоо эргүүлэх
        </button>
        <button type="button" onClick={() => onTransform("rotate")}>
          <RotateCw size={17} /> 90° эргүүлэх
        </button>
      </div>
    </div>
  );
}
